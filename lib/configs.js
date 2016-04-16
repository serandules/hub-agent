var configs = {
  "domain": "hub.serandives.com",
  "port": 4000,
  "ssl": {
    "key": "/etc/ssl/serand/hub.key",
    "cert": "/etc/ssl/serand/hub.crt",
    "ca": "/etc/ssl/serand/hub-client.crt"
  },
  "token": "tssnts"
};

module.exports = process.env.HUB_CONFIGS ? require(process.env.HUB_CONFIGS) : configs;