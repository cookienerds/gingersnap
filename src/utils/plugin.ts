import * as R from "ramda";
import { Model, ModelInternalProps, namespacedModelInternalProps } from "../annotations/model";

export interface FieldTagPropertyDescription {
  Type: any;
  fieldName: string;
  isArray: boolean;
  tagName: string;
  tagProperties: Object;
}

export interface ModelTagPropertyDescription {
  properties: Object;
  modelClassName: string;
  modelClass: any;
}

const modelClassTags: { [string: string]: ModelTagPropertyDescription } = {};

export const createModelClassAnnotationTag = R.curry((name: string, properties: Object = {}) => (constructor: any) => {
  modelClassTags[name] = {
    properties,
    modelClass: constructor.prototype,
    modelClassName: constructor.name,
  };
});

export const getModelClassAnnotationTagProperties = R.curry(
  (tagNames: string[], ModelClass: any): ModelTagPropertyDescription[] => {
    return R.map((tag) => modelClassTags[tag], tagNames).filter((v) => v);
  }
);

export const createModelFieldAnnotationTag = R.curry(
  (
      name: string,
      properties: Object = {},
      onFieldCreated?: (tagName: string, properties: Object, target: Model, fieldName: string) => void
    ) =>
    (target: any, key: string) => {
      const props: ModelInternalProps = namespacedModelInternalProps[target.constructor.name] ?? { fields: {} };
      const result = R.find(([k, v]) => v.name === key, R.toPairs(props.fields));

      if (!result) {
        throw new Error(`Cannot create annotation tag of type ${name}, field does not exist as yet`);
      }

      props.fields[result[0]].customTags = props.fields[result[0]].customTags ?? {};
      props.fields[result[0]].customTags![name] = {
        __callback__: onFieldCreated,
        properties,
      };

      props.parent = Object.getPrototypeOf(target).constructor.name;
      namespacedModelInternalProps[target.constructor.name] = props;
    }
);

export const getModelFieldAnnotationTagProperties = R.curry(
  (tagNames: string[], ModelClass: any): FieldTagPropertyDescription[] => {
    const props: ModelInternalProps = (Model as any).buildPropTree(ModelClass.name);
    return R.map(([k, v]) => {
      if (v.customTags) {
        const tagName = tagNames.find((t) => t in v.customTags!);
        return tagName
          ? {
              tagName,
              fieldName: v.name,
              Type: v.Type,
              isArray: v.isArray,
              tagProperties: v.customTags[tagName].properties,
            }
          : null;
      }
      return null;
    }, R.toPairs(props.fields)).filter((v) => v) as FieldTagPropertyDescription[];
  }
);
