import * as R from "ramda";
import ParsingError from "../../errors/ParsingError";
import X2JS from "x2js";
import "reflect-metadata";

interface IgnoreProps {
  serialize?: boolean;
  deserialize?: boolean;
}

interface FieldProps {
  ignore?: IgnoreProps;
  name: string;
  Type: any;
  isArray: boolean;
}

interface ModelInternalProps {
  fields: {
    [string: string]: FieldProps;
  };
  parent?: string;
}

const namespacedModelInternalProps: { [string: string]: ModelInternalProps } = {};

/**
 * Ignores the annotated field during serilization (by default) and/or deserialization
 * @param value an object for enabling/disabling which directions should ignore be used
 * { serialize: boolean, deserialize: boolean }
 * @constructor
 */
export const Ignore =
  (value: IgnoreProps = { serialize: true, deserialize: false }) =>
  (target: any, key: string) => {
    const props: ModelInternalProps = namespacedModelInternalProps[target.constructor.name] ?? { fields: {} };
    const field = R.find((v) => v.name === key, R.values(props.fields));
    if (field) {
      field.ignore = value;
      namespacedModelInternalProps[target.constructor.name] = props;
      props.parent = Object.getPrototypeOf(target).constructor.name;
      return;
    }
    throw new Error(`No field found that matches ${key}`);
  };

/**
 * A property that exist in the incoming data
 * @param name Name of the property in the incoming data. If not provided, the variable name will be assumed as the
 * property name
 * @constructor
 */
export const Field = (name?: string) => (target: any, key: string) => {
  const props: ModelInternalProps = namespacedModelInternalProps[target.constructor.name] ?? { fields: {} };
  props.fields[name ?? key] = {
    name: key,
    Type: Reflect.getMetadata("design:type", target, key),
    isArray: false,
  };
  props.parent = Object.getPrototypeOf(target).constructor.name;
  namespacedModelInternalProps[target.constructor.name] = props;
};

/**
 * A property that exists on the incoming data, that contains an array of same data types
 * @param type Type of data in the array
 * @param name Name of the property in the incoming data. If not provided, the variable name will be assumed as the
 * property name
 * @constructor
 */
export const ArrayField = (type: any, name?: string) => (target: any, key: string) => {
  const props: ModelInternalProps = namespacedModelInternalProps[target.constructor.name] ?? { fields: {} };
  props.fields[name ?? key] = {
    name: key,
    Type: type,
    isArray: true,
  };
  props.parent = Object.getPrototypeOf(target).constructor.name;
  namespacedModelInternalProps[target.constructor.name] = props;
};

const xmlParser = new X2JS();

/**
 * A Data de/serializer class that manages and validates data as JavaScript Objects
 */
export class Model {
  /**
   * Converts a JSON object to a Model
   * @param data JSON Object
   */
  public static fromJSON<T extends Model>(data: Object): T {
    return this.fromObject(data, false);
  }

  /**
   * Converts XML string to a Model
   * @param value XML string
   */
  public static fromXML<T extends Model>(value: string): T {
    return this.fromObject(xmlParser.xml2js(value), true);
  }

  /**
   * Converts the current model to a JSON object
   */
  public object(): { [string: string]: any } {
    const deserialize = (value: any) => {
      if (value instanceof Model) {
        return value.object();
      } else if (value instanceof Array) {
        return value.map((v) => deserialize(v));
      }
      return value;
    };

    return R.reduce(
      (acc, [key, fieldProps]) => {
        if (fieldProps.ignore?.deserialize) return acc;

        const value: any = R.prop(fieldProps.name as any, this);
        acc[key] = deserialize(value);
        return acc;
      },
      {},
      R.toPairs(Model.buildPropTree(this.constructor.name)?.fields ?? {})
    );
  }

  /**
   * Converts the current model to a JSON string
   */
  public json(): string {
    return JSON.stringify(this.object());
  }

  /**
   * Converts the current model to a XML string
   */
  public xml(): string {
    return xmlParser.js2xml(this.object());
  }

  /**
   * Constructs the model properties by traversing the inheritance tree of the current Model being instantiated
   * @param namespace Name of the model
   * @private
   */
  private static buildPropTree(namespace: string): ModelInternalProps {
    let value: ModelInternalProps;
    let space = namespace;
    const tree: ModelInternalProps = { fields: {} };

    while (space && (value = namespacedModelInternalProps[space])) {
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
  private static fromObject<T extends Model>(data: Object, xml: boolean): T {
    const model: any = new this();
    const props: ModelInternalProps = this.buildPropTree(model.constructor.name);

    if (xml && typeof (data as any) === "string") {
      data = {};
    }

    R.forEach(([key, fieldProps]: [string, any]) => {
      let value = data[key];

      if (value === undefined && fieldProps.ignore?.serialize) {
        return;
      } else if (value === undefined) {
        throw new ParsingError(`Property ${key} is missing from the data provided`);
      }

      if (fieldProps.isArray && fieldProps.Type.prototype instanceof Model) {
        if (!(value instanceof Array) && !xml) {
          throw new ParsingError(`value for ${key} is expected to be an Array, instead received ${typeof value}`);
        } else if (!(value instanceof Array) && xml) {
          value = value === "" ? [] : [value];
        }
        model[fieldProps.name] = value.map((v) => fieldProps.Type.fromObject(v, xml));
      } else if (fieldProps.Type.prototype instanceof Model) {
        model[fieldProps.name] = fieldProps.Type.fromObject(value, xml);
      } else if (fieldProps.isArray) {
        if (!(value instanceof Array) && !xml) {
          throw new ParsingError(`value for ${key} is expected to be an Array, instead received ${typeof value}`);
        } else if (!(value instanceof Array) && xml) {
          value = [value];
        }
        model[fieldProps.name] = value.map((v) => new fieldProps.Type(v));
      } else if (model[fieldProps.name] instanceof fieldProps.Type && fieldProps.Type instanceof Function) {
        model[fieldProps.name](value);
      } else {
        model[fieldProps.name] = new fieldProps.Type(value);
      }
    }, R.toPairs(props.fields));

    return model as T;
  }
}
