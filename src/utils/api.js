import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "axios";

const API_BASE_URL = "https://wren-server.vercel.app";
const AUTH_FREE_PATHS = new Set(["/auth/login", "/auth/register"]);
let currentAuthToken = null;
let unauthorizedHandler = null;
let isHandlingUnauthorized = false;

const getRequestPath = (config) => {
  const url = config?.url || "";
  return url.startsWith("http") ? url.replace(API_BASE_URL, "") : url;
};

const shouldAttachAuth = (config) => {
  if (config?.skipAuth === true) return false;
  const path = getRequestPath(config);
  return !AUTH_FREE_PATHS.has(path);
};

const api = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const applyAuthToken = (token) => {
  currentAuthToken = token || null;

  if (currentAuthToken) {
    api.defaults.headers.common.Authorization = `Bearer ${currentAuthToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

const hydrateAuthToken = async () => {
  if (currentAuthToken) return currentAuthToken;
  const storedToken = await AsyncStorage.getItem("token");
  applyAuthToken(storedToken);
  return storedToken;
};

api.interceptors.request.use(
  async (config) => {
    try {
      config.headers = config.headers || {};

      if (!shouldAttachAuth(config)) {
        delete config.headers.Authorization;
        return config;
      }

      const token = currentAuthToken || (await hydrateAuthToken());
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
    } catch (error) {
      console.error("Error preparing authenticated API request:", error);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const config = error?.config;

    if (status === 401) {
      console.warn(
        "Unauthorized API request",
        message || "Missing or invalid token",
      );

      if (
        shouldAttachAuth(config) &&
        unauthorizedHandler &&
        !isHandlingUnauthorized
      ) {
        isHandlingUnauthorized = true;
        try {
          await unauthorizedHandler(error);
        } finally {
          isHandlingUnauthorized = false;
        }
      }
    }

    if (status === 403) {
      console.warn("Forbidden API request", message || "Account access denied");
    }

    return Promise.reject(error);
  },
);

const setApiAuthToken = (token) => {
  applyAuthToken(token);
};

const clearApiAuthToken = () => {
  applyAuthToken(null);
};

const setApiUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler || null;
};

export default api;
export {
  API_BASE_URL,
  AUTH_FREE_PATHS,
  shouldAttachAuth,
  setApiAuthToken,
  clearApiAuthToken,
  hydrateAuthToken,
  setApiUnauthorizedHandler,
};
