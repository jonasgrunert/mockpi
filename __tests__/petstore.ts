import path from "path";
import MockAPI from "../src";
import https from "https";
import XML from "fast-xml-parser";

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

describe("Easily mock APIs", () => {
  it("Make it happen with one click with json responses", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/pet/69", resp => {
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
    if (petStore.getResponses()[0].code === 200) {
      expect(JSON.parse(response)).toEqual(petStore.getResponse().response);
    } else {
      expect(response).toEqual(petStore.getResponse().response);
    }
  });
  it("Make it happen with one click with xml responses", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/store/order/42", resp => {
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
    if (petStore.getResponses()[0].code === 200) {
      expect(XML.parse(response)).toEqual(petStore.getResponse().response);
    } else {
      expect(response).toEqual(petStore.getResponse({}).response);
    }
  });
  it("Setting the state is easy too", async () => {
    petStore.withState(200);
    const response: { data: string; code: number } = await new Promise(
      (res, rej) =>
        https
          .get("https://petstore.swagger.io/v2/pet/69", resp => {
            let data = "";
            resp.on("data", chunk => {
              data += chunk;
            });
            resp.on("end", () => {
              res({ data, code: resp.statusCode! });
            });
          })
          .on("error", err => {
            rej(err);
          })
    );
    expect(petStore.getCallCount()).toBe(1);
    expect(petStore.getResponses()[0].code).toBe(200);
    expect(response.code).toBe(200);
  });
  it("Setting a state a little bit more complex is also possible", async () => {
    petStore.withState(req => (req.parameters.petId === "69" ? 200 : 404));
    const response69: { data: string; code: number } = await new Promise(
      (res, rej) =>
        https
          .get("https://petstore.swagger.io/v2/pet/69", resp => {
            let data = "";
            resp.on("data", chunk => {
              data += chunk;
            });
            resp.on("end", () => {
              res({ data, code: resp.statusCode! });
            });
          })
          .on("error", err => {
            rej(err);
          })
    );
    const response: { data: string; code: number } = await new Promise(
      (res, rej) =>
        https
          .get("https://petstore.swagger.io/v2/pet/123", resp => {
            let data = "";
            resp.on("data", chunk => {
              data += chunk;
            });
            resp.on("end", () => {
              res({ data, code: resp.statusCode! });
            });
          })
          .on("error", err => {
            rej(err);
          })
    );
    expect(petStore.getCallCount()).toBe(2);
    expect(petStore.getResponse({ path: /69/ }).code).toBe(200);
    expect(petStore.getResponse({ path: /123/ }).code).toBe(404);
    expect(response69.code).toBe(200);
    expect(response.code).toBe(404);
  });
  it("Overwriting a response is simple", async () => {
    petStore.withState(400);
    petStore.withResponse(
      req => req.url.pathname.includes("/store/order"),
      "Something went wrong"
    );
    const response: { data: string; code: number } = await new Promise(
      (res, rej) =>
        https
          .get("https://petstore.swagger.io/v2/store/order/69", resp => {
            let data = "";
            resp.on("data", chunk => {
              data += chunk;
            });
            resp.on("end", () => {
              res({ data, code: resp.statusCode! });
            });
          })
          .on("error", err => {
            rej(err);
          })
    );
    expect(petStore.getCallCount()).toBe(1);
    expect(petStore.getResponse().code).toBe(400);
    expect(petStore.getResponse().response).toBe("Something went wrong");
    expect(response.code).toBe(400);
    expect(response.data).toBe("Something went wrong");
  });

  it("Matches a path with a space inside", async () => {
    const response: string = await new Promise((res, rej) =>
      https
        .get("https://petstore.swagger.io/v2/store order", resp => {
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
});
