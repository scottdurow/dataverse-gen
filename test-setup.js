module.exports = async function (globalConfig, projectConfig) {
  require("dotenv").config();
  if (process.env["DATAVERSEIFY_USEPROXY"] === "1") {
    const httpProxy = process.env["DATAVERSEIFY_PROXY"];
    console.debug("Adding proxy:" + httpProxy);
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    process.env.https_proxy = httpProxy.replace("https:", "http:");
    process.env.http_proxy = httpProxy.replace("http:", "https:");
  }
};
