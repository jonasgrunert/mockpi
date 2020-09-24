import path from "path";
import MockAPI from "../src";
import https from "https";
import { IncomingMessage } from "http";
import { TLSSocket } from "tls";
import { Socket } from "net";
import { serializeRequest } from "../src/matchResponse";

let petStore: MockAPI;
beforeAll(async () => {
  petStore = await MockAPI.mock(path.join(__dirname, "./api.yaml"));
});
afterAll(() => {
  MockAPI.unmock(petStore);
});
afterEach(() => {
  petStore.reset();
});

describe("Failing tests", () => {
  it("Unable to load spec from relative path", () => {
    expect(MockAPI.mock("./api.yaml")).rejects.toThrowError(
      /The path .* is not absolute./
    );
  });
  it("Unable to load spec from false path path", () => {
    expect(
      MockAPI.mock(path.join(__dirname, "./invalid.yaml"))
    ).rejects.toThrow();
  });
  it("Unable to match to server", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://swagger.io/v2/pet/69", resp => {
          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            res(data);
          });
        })
        .on("error", err => {
          rej(err);
        })
    );
    expect(petStore.getCallCount()).toBe(0);
  });
  it("Unable to match to Route", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/pets/69", resp => {
          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            res(data);
          });
        })
        .on("error", err => {
          rej(err);
        })
    );
    expect(petStore.getCallCount()).toBe(0);
  });
});

describe("Serialize reqeust serializes an incoming request", () => {
  it("Retrieves a correct petId from a path", () => {
    const req = new IncomingMessage(new TLSSocket(new Socket()));
    req.method = "GET";
    req.headers.host = "petstore.swagger.io";
    req.url = "/v2/pet/69";
    const ser = serializeRequest("/pet/{petId}", req);
    expect(ser.parameters.petId).toBe("69");
  });
});

describe("Mitm internal keepAlive", () => {
  it("Properly destroys connection with keep alive", async () => {
    const agent = new https.Agent({ keepAlive: true });
    for (let i = 1; i < 10000; i++) {
      await new Promise((resolve, reject) => {
        https.get("https://example.com", { agent }, res => {
          res.on("data", d => {});
          res.on("end", resolve);
        });
      });
    }
  });
});

describe("Matches also badly written urls", () => {
  it("Matches a path with an escaped space inside", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/store%20order", resp => {
          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            res(data);
          });
        })
        .on("error", err => {
          rej(err);
        })
    );
    expect(petStore.getCallCount()).toBe(1);
  });
  it("Matches a path with a variable which does not end with }", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/store/69order", resp => {
          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            res(data);
          });
        })
        .on("error", err => {
          rej(err);
        })
    );
    expect(petStore.getCallCount()).toBe(1);
  });
});
