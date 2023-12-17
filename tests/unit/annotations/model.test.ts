import { User } from "../../mocks/user";
import * as R from "ramda";
import ParsingError from "../../../src/errors/ParsingError";
import {
  Model,
  Validator,
  Field,
  LowerBound,
  Ignore,
  UpperBound,
  Range,
  RaiseError,
  Optional
} from "../../../src/annotations/model";

const MOCKED_USER = {
  name: "Will Carter",
  contact_no: "0123456789",
  timestamp: "2022-01-19T16:00:00.000Z",
  updatedAt: "2022-01-20T16:00:00.000Z",
  totalReferences: 1,
  bestie: {
    name: "Sandy Carter",
    contact_no: "0123456299",
    timestamp: "2022-01-19T16:00:00.000Z",
    updatedAt: "2022-01-20T16:00:00.000Z",
    friends: [],
    totalReferences: 1,
  },
  friends: [
    {
      name: "James Carter",
      contact_no: "0123456799",
      timestamp: "2022-01-19T16:00:00.000Z",
      updatedAt: "2022-01-20T16:00:00.000Z",
      friends: [],
      totalReferences: 1,
    },
  ],
};

class ValidObject extends Model {
  @Validator(/release-\d+/)
  @Field("version")
  version!: string;

  @LowerBound(10)
  @Field("start")
  start!: number;

  @Ignore()
  @UpperBound(20)
  @Field("end")
  end?: number;

  @Range(1, 100, true)
  @Field("floatPoint", Number)
  floatPoint!: Optional<number>;

  @Ignore()
  @RaiseError
  @Field()
  error?: Error;
}

describe("Models", () => {
  it("should validate JSON data", function () {
    const data = R.clone(MOCKED_USER);
    const user = User.fromJSON(data);
    global.fetch = async (v) =>
      ({
        ok: true,
        status: 200,
        json: () => MOCKED_USER,
      } as any);

    expect(data).toEqual(MOCKED_USER);
    expect(JSON.parse(user.json(true))).toEqual(MOCKED_USER);
    expect(R.equals(user.object(true), MOCKED_USER)).toBeFalsy();

    expect(() => User.fromJSON({})).toThrow(ParsingError);
    expect(() =>
      User.fromJSON({
        name: "Will Carter",
        contact_no: "0123456789",
        timestamp: "2022-01-19T16:00:00.000Z",
        updatedAt: "2022-01-20T16:00:00.000Z",
        totalReferences: 1,
      })
    ).toThrow(ParsingError);
    expect(
      User.fromJSON({
        name: "Will Carter",
        contact_no: "0123456789",
        timestamp: "2022-01-19T16:00:00.000Z",
        updatedAt: "2022-01-20T16:00:00.000Z",
        totalReferences: 1,
        friends: [],
      })
    ).toBeTruthy();
    expect(
      User.fromString(`{
        "name": "Will Carter",
        "contact_no": "0123456789",
        "timestamp": "2022-01-19T16:00:00.000Z",
        "updatedAt": "2022-01-20T16:00:00.000Z",
        "totalReferences": 1,
        "friends": [],
        "friendsConnection": {
          "123": {
            "name": "James Carter",
            "contact_no": "0123456799",
            "timestamp": "2022-01-19T16:00:00.000Z",
            "updatedAt": "2022-01-20T16:00:00.000Z",
            "friends": [],
            "totalReferences": 1
          }
        }
      }`)
    ).toBeTruthy();
    expect(() =>
      User.fromString(`{
        "name": "Will Carter",
        "contact_no": "0123456789",
        "timestamp": "2022-01-19T16:00:00.000Z"
        `)
    ).toThrow(ParsingError);
    expect(() => User.fromURL("https://example.com/testing.json")).toBeTruthy();
  });

  it("should validate properties", function () {
    expect(
      ValidObject.fromJSON({
        version: "release-1.2",
        start: 10,
      })
    ).toBeTruthy();
    expect(
      ValidObject.fromJSON({
        version: "release-1.2",
        start: 10,
      }).floatPoint.isPresent()
    ).toBeFalsy();
    expect(() =>
      ValidObject.fromJSON({
        version: "release-alpha-1.2.0",
      })
    ).toThrow(ParsingError);
    expect(() =>
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 1,
      })
    ).toThrow(ParsingError);
    expect(() =>
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 11,
        end: 20,
      })
    ).toThrow(ParsingError);
    expect(
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 11,
        end: 19,
      })
    ).toBeTruthy();
    expect(
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 11,
        end: 19,
        floatPoint: 100,
      })
    ).toBeTruthy();
    expect(() =>
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 11,
        end: 19,
        floatPoint: 200,
      })
    ).toThrow(ParsingError);
    expect(() =>
      ValidObject.fromJSON({
        version: "release-1.2.0",
        start: 11,
        end: 19,
        floatPoint: 100,
        error: "Testing",
      })
    ).toThrow(Error);
  });
});
