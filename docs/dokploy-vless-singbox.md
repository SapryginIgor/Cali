# Dokploy + VLESS (REALITY) for OpenAI Access

This setup routes backend outbound traffic through `sing-box` so OpenAI requests do not use the Dokploy server IP directly.

## 1) What changed

- `docker-compose.yml` now starts a `singbox` service.
- Backend uses:
  - `HTTP_PROXY=http://singbox:3128`
  - `HTTPS_PROXY=http://singbox:3128`

## 2) Add Dokploy environment variables

Set these variables in Dokploy for your app:

- `OPENAI_API_KEY`
- `APP_PORT` (optional, defaults to `8000`)
- `RATE_LIMIT_WINDOW_MS` (optional)
- `RATE_LIMIT_MAX_REQUESTS` (optional)
- `SINGBOX_CONFIG_JSON` (required, full sing-box config JSON)

## 3) `SINGBOX_CONFIG_JSON` template

Use this as the JSON value for `SINGBOX_CONFIG_JSON`:

```json
{
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "http",
      "tag": "http-in",
      "listen": "0.0.0.0",
      "listen_port": 3128
    }
  ],
  "outbounds": [
    {
      "type": "vless",
      "tag": "proxy",
      "server": "YOUR_SERVER_IP_OR_DOMAIN",
      "server_port": 443,
      "uuid": "YOUR_UUID",
      "flow": "xtls-rprx-vision",
      "tls": {
        "enabled": true,
        "server_name": "YOUR_REALITY_SERVER_NAME",
        "utls": {
          "enabled": true,
          "fingerprint": "chrome"
        },
        "reality": {
          "enabled": true,
          "public_key": "YOUR_PBK",
          "short_id": "YOUR_SHORT_ID"
        }
      }
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "final": "proxy"
  }
}
```

## 4) Mapping from your VLESS URL

Given URL fields like:

- `vless://UUID@HOST:PORT?...`
- `pbk=...`
- `sid=...`
- `fp=chrome`
- `flow=xtls-rprx-vision`

Map them to:

- `uuid` <- `UUID`
- `server` <- `HOST`
- `server_port` <- `PORT`
- `tls.reality.public_key` <- `pbk`
- `tls.reality.short_id` <- `sid`
- `tls.utls.fingerprint` <- `fp`
- `flow` <- `flow`

`server_name` must match the Reality config from your provider. If this value is wrong, the tunnel will fail.

## 5) Deploy + verify

After deploy:

1. Check `singbox` logs: it should start without config errors.
2. Check backend logs: no more `unsupported_country_region_territory`.
3. Test endpoint:
   - `POST /api/analyze-food`
4. Optional container check:
   - `curl -i https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

If you still receive `403` from OpenAI, confirm `server_name` and that your proxy exit IP is in a supported region.
