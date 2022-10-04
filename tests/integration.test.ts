import { GingerSnap } from "../src";
import { User, UserService } from "./services/user";
import * as R from "ramda";
import { UtilService } from "./services/util";
import "blob-polyfill";
import { AuthService } from "./services/auth";
import { THROTTLE_DEFAULT_MS } from "../src/annotations/service";

jest.setTimeout(10000);

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

  it("should create user", async () => {
    (global.fetch as any) = async () => ({
      json: async () => R.clone(MOCKED_USERS[0]),
      status: 200,
      ok: true,
    });

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const resp = await service.createUser(User.fromJSON(MOCKED_USERS[0])).execute();
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());
  });

  it("should delete user", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      if (url.toString() === "https://test.com/users/test-id" && options.headers["Session-Id"] === "test-session") {
        return {
          json: async () => R.clone(MOCKED_USERS[0]),
          status: 200,
          ok: true,
        };
      }
      return {
        text: async () => "",
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const resp = await service.deleteUser("test-id", "test-session").execute();
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());
  });

  it("should update user", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      if (
        url.toString() === "https://test.com/users/test-id" &&
        options.headers["Session-Id"] === "test-session" &&
        options.method.toLowerCase() === "put"
      ) {
        return {
          json: async () => R.clone(MOCKED_USERS[0]),
          status: 200,
          ok: true,
        };
      }
      return {
        text: async () => "",
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const resp = await service
      .updateUser(User.fromJSON(MOCKED_USERS[0]), "test-id", { "Session-Id": "test-session" })
      .execute();
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());
  });

  it("should get user by query", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      if (url.toString() === "https://test.com/users?name=test" && options.method.toLowerCase() === "get") {
        return {
          json: async () => R.clone(MOCKED_USERS[0]),
          status: 200,
          ok: true,
        };
      } else if (
        url.toString() === "https://test.com/users?name=test&tel=1234567" &&
        options.method.toLowerCase() === "get"
      ) {
        return {
          json: async () => R.clone(MOCKED_USERS[0]),
          status: 200,
          ok: true,
        };
      }
      return {
        text: async () => "",
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const start = performance.now();
    let resp = await service.getUserByName("test").execute();
    const end = performance.now();

    // Check that the request was throttled
    expect(end - start).toBeGreaterThan(3000);
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());

    resp = await service.getUserByProperties({ name: "test", tel: "1234567" }).execute();
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());
  });

  it("should get user by overriding queries", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      if (url.toString() === "https://test.com/users?tel=0987654321" && options.method.toLowerCase() === "get") {
        return {
          json: async () => R.clone(MOCKED_USERS[0]),
          status: 200,
          ok: true,
        };
      }
      return {
        text: async () => "",
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UserService);
    const start = performance.now();
    const resp = await service.getUserByTel("0987654321").execute();
    const end = performance.now();

    // Check that the request was throttled
    expect(end - start).toBeGreaterThan(1000);
    expect(end - start).toBeLessThan(2000);
    expect(resp instanceof User).toBeTruthy();
    expect(resp.json()).toEqual(User.fromJSON(MOCKED_USERS[0]).json());
  });

  it("should complete health check", async () => {
    (global.fetch as any) = async (url: string, options: any) => ({
      text: async () => "Ok",
      status: 200,
      ok: true,
    });

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const resp: String = await service.healthCheck().execute();

    expect(resp instanceof String).toBeTruthy();
    expect(resp.toString()).toEqual("Ok");
  });

  it("should get binary data response", async () => {
    (global.fetch as any) = async (url: string, options: any) => ({
      blob: async () => new Blob(["Ok"]),
      status: 200,
      ok: true,
    });

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const resp = await service.downloadFile().execute();

    expect(resp instanceof Blob).toBeTruthy();
    expect(await resp.text()).toEqual("Ok");
  });

  it("should upload text file", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      expect(options.body).toEqual("sample text");
      return {
        status: 200,
        ok: true,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const resp = await service.uploadTextFile("sample text").execute();

    expect(resp).toBe(null);
  });

  it("should upload form urlencoded", async () => {
    (global.fetch as any) = async (url: string, options: any) => {
      expect(options.body instanceof URLSearchParams).toBeTruthy();
      expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(Array.from(options.body.entries())).toEqual([
        ["name", "test"],
        ["age", "21"],
      ]);
      return {
        status: 200,
        ok: true,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const resp = await service.uploadUserForm("test", 21).execute();

    expect(resp).toBe(null);
  });

  it("should upload multipart with auth", async () => {
    let called = 0;
    (global.fetch as any) = async (url: string, options: any) => {
      called++;
      if (!options.headers.Authorization) {
        return {
          status: 401,
          ok: false,
        };
      }
      expect(options.headers.Authorization.includes("Basic ")).toBeTruthy();
      expect(options.headers["Content-Type"]).toBe("multipart/form-data");
      expect(options.body instanceof FormData).toBeTruthy();
      expect(Array.from(options.body.entries())).toEqual([
        ["file", new File([new Blob(["test"])], "name")],
        ["name", "test-upload"],
      ]);
      return {
        status: 200,
        ok: true,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const resp = await service.uploadFileAndName(new Blob(["test"]), "test-upload").execute();

    expect(resp).toBe(null);
    expect(called).toBe(2);
  });

  it("should upload xml with auth refresh", async () => {
    let refreshed = false;
    (global.fetch as any) = async (url: string, options: any) => {
      if (url.toString() === "https://test.com/api/v1/auth/refresh") {
        refreshed = true;
        return {
          json: async () => ({
            username: "test",
            password: "password",
          }),
          status: 200,
          ok: true,
        };
      } else if (url.toString() === "https://test.com/upload/xml" && refreshed) {
        expect(options.headers.Authorization).toEqual(`Basic ${btoa("test:password")}`);
        expect(options.body).toEqual(User.fromJSON(MOCKED_USERS[0]).xml());
        return {
          status: 200,
          ok: true,
        };
      } else if (url.toString() === "https://test.com/upload/xml" && !refreshed) {
        return {
          status: 401,
          ok: false,
        };
      }
      return {
        text: async () => "",
        status: 400,
        ok: false,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    service.loginAnonymously();
    const resp = await service.uploadXML(User.fromJSON(MOCKED_USERS[0])).execute();

    expect(resp).toBe(null);
  });

  it("should retry request on service failure", async () => {
    let called = 0;
    (global.fetch as any) = async (url: string, options: any) => {
      called++;
      if (called <= 3) {
        return {
          status: 503,
          ok: false,
        };
      }
      return {
        text: async () => "check",
        status: 200,
        ok: true,
      };
    };

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(UtilService);
    const start = performance.now();
    const resp = await service.healthCheck().execute();
    const end = performance.now();
    expect(end - start).toBeGreaterThanOrEqual(THROTTLE_DEFAULT_MS * 3);
    expect(resp.toString()).toBe("check");
    expect(called).toBe(4);
  });

  it("should login with optional field", async () => {
    (global.fetch as any) = async (url: string, options: any) => ({
      json: async () => ({ accessToken: "jwt", refreshToken: "jwt-refresh" }),
      status: 200,
      ok: true,
    });

    const snap = new GingerSnap({ baseUrl: "https://test.com" });
    const service = snap.create(AuthService);
    const resp = await service.loginWithEmailAndPassword("test@test.com").execute();
    expect(resp.accessToken.toString()).toBe("jwt");
    expect(resp.refreshToken?.toString()).toBe("jwt-refresh");
  });
});
