import * as R from "ramda";
import { FieldProps, IgnoreProps, Model, ModelInternalProps, namespacedModelInternalProps } from "./model";
import InvalidValue from "../../errors/InvalidValue";
import { DataType } from "./types";

/**
 * Creates a decorator that updates a field
 * @param functor updater function
 * @returns a decorator
 */
const createFieldUpdater =
  (functor: (v: { field: FieldProps; target: any; key: string }) => void) => (target: any, key: string) => {
    const props: ModelInternalProps = namespacedModelInternalProps.get(target.constructor.name) ?? {
      fields: new Map(),
    };
    const field = R.find((v) => v.name === key, Array.from(props.fields.values()));
    if (!field) throw new Error(`No field found that matches ${key}`);

    functor({ field, target, key });
    props.parent = Object.getPrototypeOf(target).constructor.name;
    namespacedModelInternalProps.set(target.constructor.name, props);
  };

/**
 * Creates a validator decorator
 * @param functor validation function
 * @param error error to be thrown when validation fails
 * @param updater optional argument to update the current field
 * @returns a decorator
 */
const createValidator = (functor: (v: any) => boolean, error: Error, updater?: (f: FieldProps) => void) =>
  createFieldUpdater(({ field, target, key }) => {
    const symbol = Symbol(key);
    Object.defineProperty(target, key, {
      get: function () {
        return this[symbol];
      },
      set: function (v: any) {
        if (!functor(v)) throw error;
        this[symbol] = v;
      },
    });
    if (updater) updater(field);
  });

/**
 * Validates the value assigned to the associated property
 * @param matcher functor to check if the assigned value is valid
 */
export const Validator = (matcher: string | number | boolean | ((v: any) => boolean) | RegExp) =>
  createValidator(
    matcher instanceof Function ? matcher : matcher instanceof RegExp ? (v) => matcher.test(v) : (v) => v === matcher,
    new InvalidValue(`Invalid value assigned`)
  );

/**
 * Ignores the annotated field during deserialization (by default) and/or serialization
 * @param value an object for enabling/disabling which directions should ignore be used
 * @constructor
 */
export const Ignore = (value: IgnoreProps = { serialize: false, deserialize: true }) =>
  createFieldUpdater(({ field }) => {
    field.ignore = value;
    if (value.serialize) delete field.schema;
    else if (field.schema) {
      const options = field.schema?.options ?? {};
      options.optional = true;
      field.schema.options = options;
    }
  });

/**
 * A property that exist in the incoming data
 * @param name Name of the property in the incoming data. If not provided, the variable name will be assumed as the
 * property name
 * @constructor
 */
export const Field = (name?: string) => (target: any, key: string) => {
  const props: ModelInternalProps = namespacedModelInternalProps.get(target.constructor.name) ?? { fields: new Map() };
  const type = Reflect.getMetadata("design:type", target, key);
  const schema: any = {};
  if (type instanceof Number) {
    schema.dataType = DataType.DOUBLE;
  } else if (type instanceof String) {
    schema.dataType = DataType.STRING;
  } else if (type instanceof Boolean) {
    schema.dataType = DataType.BOOLEAN;
  } else if (type instanceof Model) {
    schema.dataType = DataType.RECORD;
    schema.options = { recordClass: type };
  }

  props.fields.set(name ?? key, {
    name: key,
    Type: type,
    isArray: false,
    schema,
  });
  props.parent = Object.getPrototypeOf(target).constructor.name;
  namespacedModelInternalProps.set(target.constructor.name, props);
};

/**
 * A property that exists on the incoming data, that contains an array of same data types
 * @param type Type of data in the array
 * @param name Name of the property in the incoming data. If not provided, the variable name will be assumed as the
 * property name
 * @constructor
 */
export const ArrayField = (type: any, name?: string) => (target: any, key: string) => {
  const props: ModelInternalProps = namespacedModelInternalProps.get(target.constructor.name) ?? { fields: new Map() };
  const schema: any = { dataType: DataType.ARRAY };
  if (type instanceof Number) {
    schema.itemType = DataType.DOUBLE;
  } else if (type instanceof String) {
    schema.itemType = DataType.STRING;
  } else if (type instanceof Boolean) {
    schema.itemType = DataType.BOOLEAN;
  } else if (type instanceof Model) {
    schema.options = { recordClass: type };
  }

  props.fields.set(name ?? key, {
    name: key,
    Type: type,
    isArray: true,
    schema,
  });
  props.parent = Object.getPrototypeOf(target).constructor.name;
  namespacedModelInternalProps.set(target.constructor.name, props);
};

/**
 * Alternative name for the associated field
 * @param name
 */
export const Alias = (name: string) =>
  createFieldUpdater(({ field }) => {
    const aliases: string[] = field.aliases ?? [];
    aliases.push(name);
    field.aliases = aliases;
  });

/**
 * Registers a schema type for the given field
 * @param dataType
 * @param options
 */
export const SchemaType = (
  dataType: DataType,
  options?: { values?: string[]; length?: number; itemType?: string; recordClass?: any; optional?: boolean }
) =>
  createFieldUpdater(
    ({ field }) =>
      (field.schema = {
        dataType,
        options,
      })
  );

/**
 * Decorator that applies a lower limit validation on a numeric field
 * @param value limit
 * @param inclusive should the limit be included. Default is false
 */
export const LowerBound = (value: number, inclusive = true) =>
  createValidator(
    inclusive ? (v: any) => v >= value : (v: any) => v > value,
    new InvalidValue(`value is lower than the minimum value of ${value}`)
  );

/**
 * Decorator that applies an upper limit validation on a numeric field
 * @param value limit
 * @param inclusive should the limit be included. Default is false
 */
export const UpperBound = (value: number, inclusive = false) =>
  createValidator(
    inclusive ? (v: any) => v <= value : (v: any) => v < value,
    new InvalidValue(`value is higher than the maximum value of ${value}`)
  );

/**
 * Decorator that applies a range validation on a numeric field
 * @param lower lower bound
 * @param upper upper bound
 * @param inclusive should the upper bound be included. Default is false
 */
export const Range = (lower: number, upper: number, inclusive = false) =>
  createValidator(
    inclusive ? (v: any) => lower <= v && v <= upper : (v: any) => lower <= v && v < upper,
    new InvalidValue(`value is not within the range of ${lower} <= v ` + (inclusive ? `<= ${upper}` : `< ${upper}`))
  );
