import { Stream } from "../../../src/stream";
import userData from "../../data/users.json";
import * as R from "ramda";

describe("Stream", () => {
  it("should bulk transform data", async () => {
    const result = await Stream.of(userData.users)
      .map(R.pick(["firstName", "lastName"]))
      .map((v) => v.firstName + " " + v.lastName)
      .chunk(2)
      .map((users) => users[0] + " and " + users[1])
      .skip(4)
      .filter(R.complement(R.includes("Price")))
      .chunk(2)
      .flatten()
      .take(2)
      .collect();
    expect(result).toEqual(["Marcel Jones and Assunta Rath", "Trace Douglas and Enoch Lynch"]);
  });
});
