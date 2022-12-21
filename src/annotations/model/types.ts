export enum DataFormat {
  AVRO,
  CSV,
  XML,
  JSON,
  MESSAGE_PACK,
  CBOR,
}

export enum DataType {
  RECORD = "record",
  NULL = "null",
  BOOLEAN = "boolean",
  INT = "int",
  LONG = "long",
  FLOAT = "float",
  DOUBLE = "double",
  BYTES = "bytes",
  STRING = "string",
  ENUM = "enum",
  MAP = "map",
  FIXED_STRING = "fixed",
  ARRAY = "array",
}
