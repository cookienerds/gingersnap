import * as R from "ramda";
import ParsingError from "../../errors/ParsingError";
import X2JS from "x2js";
import "reflect-metadata";
import { DataFormat, DataType } from "./types";
import Papa from "papaparse";
import { decode as cborDecode, encode as cborEncode } from "cborg";
import { decode as msgUnpack, encode as msgPack } from "@msgpack/msgpack";
import avro from "avsc";
import NetworkError from "../../errors/NetworkError";
import NotImplemented from "../../errors/NotImplemented";
import InvalidValue from "../../errors/InvalidValue";

/**
 * Properties for handling de/serialization process for each property on a model
 */
export interface IgnoreProps {
  /**
   * Should serialization be enabled
   */
  serialize?: boolean;

  /**
   * Should deserialization be enabled
   */
  deserialize?: boolean;
}

/** @ignore */
export interface FieldProps {
  ignore?: IgnoreProps;
  name: string;
  Type: any;
  isArray: boolean;
  aliases?: string[];
  schema?: {
    dataType: DataType;
    options?: { values?: string[]; length?: number; itemType?: string; recordClass?: any; optional?: boolean };
    aliases?: string[];
  };
  customTags?: {
    [string: string]: {
      properties: Object;
      __callback__?: (name: string, properties: Object, target: Model, fieldName: string) => void;
    };
  };
}

/** @ignore */
export interface ModelInternalProps {
  fields: {
    [string: string]: FieldProps;
  };
  parent?: string;
}

/** @ignore */
export const namespacedModelInternalProps = new Map<string, ModelInternalProps>();

const modelSchema = new Map<string, { json?: any; avro?: any }>();

/**
 * A Data de/serializer class that manages and validates data as JavaScript Objects
 */
export class Model {
  /** @ignore */
  private static readonly __xmlParser__: X2JS = new X2JS();

  /**
   * Converts arraybuffer to a model
   * @param data arraybuffer
   * @param format data format
   * @param options configurations for deserializing the data
   * @returns new model or an array of models
   */
  public static fromBuffer<T extends Model>(
    data: Uint8Array | Buffer,
    format: DataFormat = DataFormat.AVRO,
    options?: { headers?: string[]; ignoreErrors?: boolean; array?: boolean; delimiter?: string; newline?: string }
  ): T | T[] {
    switch (format) {
      case DataFormat.AVRO:
      case DataFormat.MESSAGE_PACK:
      case DataFormat.CBOR: {
        const decoder =
          format === DataFormat.CBOR
            ? cborDecode
            : format === DataFormat.AVRO
            ? (avro.Type.forSchema(this.schema(DataFormat.AVRO)).fromBuffer as (v: Uint8Array | Buffer) => any)
            : msgUnpack;
        const result = decoder(data);
        if (options?.array && !(result instanceof Array)) throw new ParsingError([], "expected an array of models");
        if (!options?.array && result instanceof Array) throw new ParsingError([], "expected only one model");

        if (result instanceof Array) return result.map((v: any) => this.fromJSON<T>(v));
        return this.fromJSON<T>(result);
      }
      case DataFormat.CSV: {
        const text = data instanceof Uint8Array ? new TextDecoder().decode(data.buffer) : (data as Buffer).toString();
        return this.fromString<T>(text, format, options);
      }
      case DataFormat.XML:
      case DataFormat.JSON:
        return this.fromString<T>(
          data instanceof Uint8Array ? new TextDecoder().decode(data) : (data as Buffer).toString(),
          format,
          options
        );
    }
  }

  /**
   * Downloads data from the given source and deserializes the data to one or more models
   * @param source URL source to fetch the data
   * @param format data format
   * @param options configurations for deserializing and/or retrieving the data
   * @returns one or more models
   */
  public static async fromURL<T extends Model>(
    source: string,
    format: DataFormat = DataFormat.AVRO,
    options?: {
      headers?: string[];
      ignoreErrors?: boolean;
      array?: boolean;
      delimiter?: string;
      newline?: string;
      requestHeaders?: any;
      mode?: any;
    }
  ): Promise<T | T[]> {
    const fetcher = fetch;
    const resp = await fetcher(source, {
      method: "GET",
      headers: options?.requestHeaders,
      mode: options?.mode,
    });
    if (!resp.ok) throw new NetworkError(resp.status);
    return await this.fromBlob<T>(await resp.blob(), format, options);
  }

  /**
   * Deserializes one or more models from a Blob
   * @param data blob data
   * @param format data format
   * @param options configurations for deserializing the data
   * @returns one or more models
   */
  public static async fromBlob<T extends Model>(
    data: Blob,
    format: DataFormat = DataFormat.AVRO,
    options?: { headers?: string[]; ignoreErrors?: boolean; array?: boolean; delimiter?: string; newline?: string }
  ): Promise<T | T[]> {
    return this.fromBuffer<T>(new Uint8Array(await data.arrayBuffer()), format);
  }

  /**
   * Deserializes one or more models from given string
   *
   * @remarks
   * If the data format is a binary one, the provided string should be a hexadecimal string.
   * @param data string data source
   * @param format data format
   * @param options
   */
  public static fromString<T extends Model>(
    data: string,
    format: DataFormat = DataFormat.AVRO,
    options?: { headers?: string[]; ignoreErrors?: boolean; array?: boolean; delimiter?: string; newline?: string }
  ): T | T[] {
    switch (format) {
      case DataFormat.JSON:
        return this.fromJSON<T>(JSON.parse(data));
      case DataFormat.XML:
        return this.fromObject<T>(this.__xmlParser__.xml2js(data), true);
      case DataFormat.CSV: {
        let text = data;
        if (options?.headers) text = options.headers.join(options?.delimiter ?? ",") + (options.newline ?? "\n") + text;

        const result = Papa.parse<T>(text, {
          header: true,
          skipEmptyLines: true,
        });

        if (!options?.ignoreErrors && result.errors.length > 0) throw new ParsingError(result.errors);
        if (!options?.array && result.data.length > 0) throw new ParsingError([], "Too many records found");

        if (options?.array) return result.data.map((v) => this.fromObject<T>(v));
        return this.fromObject<T>(result.data[0]);
      }
      default:
        return this.fromBuffer(new Uint8Array(data.match(/../g)?.map((h) => parseInt(h, 16)) ?? []), format, options);
    }
  }

  /**
   * Converts a JSON object to a model
   * @param data JSON Object
   * @returns new model
   */
  public static fromJSON<T extends Model>(data: Object): T {
    return this.fromObject(data, false);
  }

  /**
   * Retrieves the schema layout for the current model class
   * @remarks
   * Currently only AVRO schema is supported
   *
   * @param format data format that the schema is associated with
   * @returns the model's schema
   */
  public static schema(format: DataFormat = DataFormat.JSON) {
    return this.schemaWithCache(format);
  }

  /**
   * Converts the current model to a JSON object
   */
  public object(removeMissingFields = false): { [string: string]: any } {
    const serialize = (value: any) => {
      if (value instanceof Model) {
        return value.object(removeMissingFields);
      } else if (value instanceof Array) {
        return value.map((v) => serialize(v));
      }
      return value;
    };

    return R.reduce(
      (acc, [key, fieldProps]) => {
        if (fieldProps.ignore?.serialize) return acc;

        const value: any = R.prop(fieldProps.name as any, this);
        const serializedValue = serialize(value);
        if (!removeMissingFields || (serializedValue !== null && serializedValue !== undefined)) {
          acc[key] = serializedValue;
        }
        return acc;
      },
      {},
      R.toPairs(Model.buildPropTree(this.constructor.name)?.fields ?? {})
    );
  }

  /**
   * Converts the current model to a JSON string
   */
  public json(removeMissingFields = false): string {
    return JSON.stringify(this.object(removeMissingFields));
  }

  /**
   * Converts the current model to an arraybuffer
   */
  public buffer(removeMissingFields = false): ArrayBuffer {
    return new TextEncoder().encode(this.json(removeMissingFields));
  }

  /**
   * Converts the current model to a blob
   */
  public blob(removeMissingFields = false): Blob {
    return new Blob([this.buffer(removeMissingFields)]);
  }

  /**
   * Converts the current model to an XML string
   */
  public xml(removeMissingFields = false): string {
    return Model.__xmlParser__.js2xml(this.object(removeMissingFields));
  }

  /**
   * Generates avro format for the data stored in the model
   */
  public avro(removeMissingFields = false): Buffer {
    return avro.Type.forSchema(this.schema(DataFormat.AVRO)).toBuffer(this.object(removeMissingFields));
  }

  /**
   * Converts the current model to message pack binary format
   * @returns message pack binary
   */
  public messagePack(removeMissingFields = false): Buffer {
    return msgPack(this.object(removeMissingFields)).buffer as Buffer;
  }

  /**
   * Converts the current model to CBOR binary format
   * @returns cbor binary
   */
  public cbor(removeMissingFields = false): Buffer {
    return cborEncode(this.object(removeMissingFields));
  }

  /**
   * Converts the current model to csv format
   * @param removeMissingFields
   * @param config CSV unparsing configuration
   * @returns csv string
   */
  public csv(removeMissingFields = false, config?: Papa.UnparseConfig): string {
    return Papa.unparse([this.object(removeMissingFields)], config);
  }

  /**
   * Retrieves the schema of the current model based on the selected format
   * @param format data format
   * @returns the schema for the current model
   */
  public schema(format: DataFormat = DataFormat.JSON) {
    return (Object.getPrototypeOf(this) as Model).schema(format);
  }

  /**
   * Constructs the model properties by traversing the inheritance tree of the current Model being instantiated
   * @param namespace Name of the model
   * @ignore
   */
  private static buildPropTree(namespace: string): ModelInternalProps {
    let value: ModelInternalProps | undefined;
    let space = namespace;
    const tree: ModelInternalProps = { fields: {} };

    while (space && (value = namespacedModelInternalProps.get(space))) {
      tree.fields = { ...tree.fields, ...value.fields };
      space = value.parent ?? "";
    }
    return tree;
  }

  /**
   * Constructs a model from a JSON object
   * @param data JSON object
   * @param xml Whether this JSON object was derived from XML (used to properly parse missing data issues)
   * @private
   */
  private static fromObject<T extends Model>(data: Object, xml: boolean = false): T {
    const model: any = new this();
    const props: ModelInternalProps = this.buildPropTree(model.constructor.name);

    if (xml && typeof (data as any) === "string") {
      data = {};
    }

    R.forEach(([key, fieldProps]: [string, FieldProps]) => {
      let value = data[key];

      if (value === undefined) {
        for (const alias of fieldProps.aliases ?? []) {
          value = data[alias];
          if (value !== undefined) break;
        }
      }

      if (value === undefined && fieldProps.ignore?.deserialize) {
        return;
      } else if (value === undefined && (model[key] === undefined || model[key] === null)) {
        throw new ParsingError([], `Property ${key} is missing from the data provided`);
      } else if (value === undefined && !(model[key] === undefined || model[key] === null)) {
        return;
      }

      if (fieldProps.isArray && fieldProps.Type.prototype instanceof Model) {
        if (!(value instanceof Array) && !xml) {
          throw new ParsingError([], `value for ${key} is expected to be an Array, instead received ${typeof value}`);
        } else if (!(value instanceof Array) && xml) {
          value = value === "" ? [] : [value];
        }
        model[fieldProps.name] = value.map((v) => fieldProps.Type.fromObject(v, xml));
      } else if (fieldProps.Type.prototype instanceof Model) {
        model[fieldProps.name] = fieldProps.Type.fromObject(value, xml);
      } else if (fieldProps.isArray) {
        if (!(value instanceof Array) && !xml) {
          throw new ParsingError([], `value for ${key} is expected to be an Array, instead received ${typeof value}`);
        } else if (!(value instanceof Array) && xml) {
          value = [value];
        }
        model[fieldProps.name] = value.map((v) => new fieldProps.Type(v));
      } else if (model[fieldProps.name] instanceof fieldProps.Type && fieldProps.Type instanceof Function) {
        if (fieldProps.Type.prototype?.constructor) {
          model[fieldProps.name] = new fieldProps.Type(value);
        } else {
          model[fieldProps.name](value);
        }
      } else if (fieldProps.Type?.name === "String") {
        model[fieldProps.name] = String(value);
      } else if (fieldProps.Type?.name === "Boolean") {
        model[fieldProps.name] = Boolean(value);
      } else if (fieldProps.Type?.name === "Number") {
        model[fieldProps.name] = Number(value);
      } else if (fieldProps.Type?.name === "Map") {
        const valueType = typeof value;
        switch (valueType) {
          case "object": {
            model[fieldProps.name] = value instanceof Array ? new Map(value) : new Map(Object.entries(value));
            break;
          }
          case "string":
            model[fieldProps.name] = new Map(JSON.parse(value));
            break;
          default:
            throw new ParsingError([value], `value for ${key} cannot be converted to a Map`);
        }
      } else if (fieldProps.Type?.name === "Set") {
        if (value instanceof Array) {
          model[fieldProps.name] = new Set(value);
        } else if (typeof value === "string") {
          model[fieldProps.name] = new Set(JSON.parse(value));
        }
        throw new ParsingError([value], `value for ${key} cannot be converted to a Set`);
      } else {
        model[fieldProps.name] = new fieldProps.Type(value);
      }

      R.forEach(([k, v]) => {
        if (v.__callback__) v.__callback__(k, v.properties, model, fieldProps.name);
      }, R.toPairs(fieldProps.customTags ?? {}));
    }, R.toPairs(props.fields));

    return model as T;
  }

  /** @ignore */
  private static schemaWithCache(format: DataFormat = DataFormat.JSON, visitedRecords = new Map<string, any>()) {
    const model: any = new this();
    const schemas = modelSchema.get(model.constructor.name) ?? {};

    switch (format) {
      case DataFormat.AVRO: {
        if (schemas.avro) return schemas.avro;
        const className: string = model.constructor.name;
        const props: ModelInternalProps = this.buildPropTree(className);
        const avro: any = {
          type: "record",
          name: className,
          fields: [],
        };
        visitedRecords.set(className, avro.fields);

        R.forEach(([k, v]) => {
          const schemaDetails = v.schema;
          const field: any = {
            name: k,
            type: "" as any,
          };
          const name = className + k.charAt(0).toUpperCase() + k.substring(1);

          if (!schemaDetails) return;

          switch (schemaDetails.dataType) {
            case DataType.ENUM: {
              field.type = {
                type: schemaDetails.options?.optional ? [DataType.NULL, DataType.ENUM] : DataType.ENUM,
                aliases: schemaDetails.aliases,
                symbols: schemaDetails.options?.values ?? [],
                name,
              };
              break;
            }
            case DataType.FIXED_STRING: {
              field.type = {
                type: schemaDetails.options?.optional ? [DataType.NULL, DataType.FIXED_STRING] : DataType.FIXED_STRING,
                aliases: schemaDetails.aliases,
                size: schemaDetails.options?.length ?? 0,
                name,
              };
              break;
            }
            case DataType.MAP: {
              field.type = {
                type: schemaDetails.options?.optional ? [DataType.NULL, DataType.MAP] : DataType.MAP,
                values: schemaDetails.options?.itemType ?? "",
                aliases: schemaDetails.aliases,
                default: {},
                name,
              };
              break;
            }
            case DataType.ARRAY: {
              if (schemaDetails.options?.recordClass) {
                field.type = {
                  type: schemaDetails.options?.optional ? [DataType.NULL, DataType.ARRAY] : DataType.ARRAY,
                  aliases: schemaDetails.aliases,
                  default: [],
                  name,
                };
                const visited = visitedRecords.get(schemaDetails.options.recordClass.constructor.name);
                if (visited) {
                  field.type.items = {
                    type: DataType.RECORD,
                    name: name + "Record",
                    fields: visited,
                  };
                } else {
                  field.type.items = schemaDetails.options.recordClass.schemaWithCache(format, visitedRecords);
                }
                visitedRecords.set(schemaDetails.options.recordClass.constructor.name, field.type.items.fields);
              } else {
                field.type = {
                  type: schemaDetails.options?.optional ? [DataType.NULL, DataType.ARRAY] : DataType.ARRAY,
                  items: schemaDetails.options?.itemType ?? "",
                  aliases: schemaDetails.aliases,
                  default: [],
                  name,
                };
              }
              break;
            }
            case DataType.RECORD: {
              if (!schemaDetails.options?.recordClass) {
                throw new InvalidValue("class description for record type is missing");
              }
              const visited = visitedRecords.get(schemaDetails.options.recordClass.constructor.name);
              if (visited) {
                field.type = {
                  type: schemaDetails.options?.optional ? [DataType.NULL, DataType.RECORD] : DataType.RECORD,
                  name,
                  fields: visited,
                };
              } else {
                field.type = schemaDetails.options.recordClass.schemaWithCache(format, visitedRecords);
              }
              visitedRecords.set(schemaDetails.options.recordClass.constructor.name, field.type.fields);
              break;
            }
            default: {
              field.type = schemaDetails.dataType;
              field.aliases = schemaDetails.aliases;
            }
          }
          avro.fields.push(field);
        }, R.toPairs(props.fields));

        schemas.avro = avro;
        modelSchema.set(model.constructor.name, schemas);
        return schemas.avro;
      }
      default:
        throw new NotImplemented("data format schema not implemented");
    }
  }
}
