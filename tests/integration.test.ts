import { GingerSnap } from "../src/annotations/core";
import { UserService } from "./services/user";

const MOCKED_USERS = [
  {
    name: "Will Carter",
    contact_no: "0123456789",
    timestamp: "January 20, 2022",
    updatedAt: "January 21, 2022",
    totalReferences: 1,
    bestie: {
      name: "Sandy Carter",
      contact_no: "0123456299",
      timestamp: "January 20, 2022",
      updatedAt: "January 21, 2022",
      friends: [],
      totalReferences: 1,
    },
    friends: [
      {
        name: "James Carter",
        contact_no: "0123456799",
        timestamp: "January 20, 2022",
        updatedAt: "January 21, 2022",
        friends: [],
        totalReferences: 1,
      },
    ],
  },
];
const MOCKED_PROFILES = MOCKED_USERS.map((v) => ({
  ...v,
  profilePicture: "picture.jpeg",
  bioLink: `https://wiki.com/${encodeURI(v.name)}`,
}));

describe("Test Network Service", function () {
  it("should lookup all users", async () => {
    (global.fetch as any) = async () => ({
      json: async () => MOCKED_USERS,
      status: 200,
      ok: true,
    });

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const call = service.getUsers();
    const users = await call.execute();
    expect(users).toHaveLength(1);
    expect(users[0]).toBeTruthy();
    expect(String(users[0].tel)).toEqual("0123456789");
    expect(String(users[0].name)).toEqual("Will Carter");
    expect(users[0].createdOn.toISOString()).toEqual(new Date("January 20, 2022").toISOString());
    expect(users[0].updatedAt.toISOString()).toEqual(new Date("January 21, 2022").toISOString());
    expect(users[0].references).toBe(1);
    expect(users[0].friends).toHaveLength(1);
    expect(String(users[0].friends[0].name)).toEqual("James Carter");
    expect(users[0].bestie).toBeDefined();
    expect(String(users[0].bestie?.name)).toEqual("Sandy Carter");
  });

  it("should lookup user profile and bio", async () => {
    (global.fetch as any) = async (url: string) => {
      if (url.toString() === "https://test.com/feeds/users/test-id") {
        return {
          text: async () => `
          <?xml version="1.0" encoding="ISO-8859-1" ?>
          <profile>
            <profilePicture>picture.jpeg</profilePicture>
            <bioLink>https://wiki.com/Will%20Carter</bioLink>
            <name>Will Carter</name>
            <friends>
                <name>James Carter</name>
                <contact_no>0123456799</contact_no>
                <timestamp>January 20, 2022</timestamp>
                <updatedAt>January 21, 2022</updatedAt>
                <totalReferences>1</totalReferences>
                <friends />
            </friends>
            <contact_no>0123456789</contact_no>
            <timestamp>January 20, 2022</timestamp>
            <bestie>
                <name>Sandy Carter</name>
                <contact_no>0123456299</contact_no>
                <timestamp>January 20, 2022</timestamp>
                <updatedAt>January 21, 2022</updatedAt>
                <totalReferences>1</totalReferences>
                <friends></friends>
            </bestie>
            <updatedAt>January 21, 2022</updatedAt>
            <totalReferences>1</totalReferences>
          </profile>
          `,
          status: 200,
          ok: true,
        };
      }
      return {
        text: Promise.resolve("Invalid request"),
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const call = service.getUserFeed("test-id");
    const data = await call.execute();
    expect(data).toBeDefined();
    const profile = data.profile;

    expect(profile).toBeDefined();
    expect(String(profile.tel)).toEqual("0123456789");
    expect(String(profile.name)).toEqual("Will Carter");
    expect(profile.createdOn.toISOString()).toEqual(new Date("January 20, 2022").toISOString());
    expect(profile.updatedAt.toISOString()).toEqual(new Date("January 21, 2022").toISOString());
    expect(profile.references).toBe(1);
    expect(profile.friends).toHaveLength(1);
    expect(String(profile.friends[0].name)).toEqual("James Carter");
    expect(profile.bestie).toBeDefined();
    expect(String(profile.bestie?.name)).toEqual("Sandy Carter");
    expect(String(profile.profilePicture)).toEqual("picture.jpeg");
    expect(String(profile.bioLink)).toEqual(`https://wiki.com/${encodeURI(profile.name.toString())}`);
  });
});
