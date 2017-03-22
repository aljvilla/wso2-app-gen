WSO2 Appgen
---
Script desarrollado para crear de forma automática las aplicaciones en WSO2 y suscribir las Apis asociadas.

Archivo de configuración *module.json*
---
```json

{
    "name": "AppName",
    "description": "",
    "oauth2CallbackUrl": "http://....",
    "dependencies": [
        {
            "apiName": "ApiName",
            "apiVersion": "1.0",
            "tier": "Unlimited"
        }        
    ]
}
```

Ejemplo de uso
---

```js
cat << EOF > appgen.js
const gen = require('conicyt-wso2-appgen') 
new gen.Client(
    {
      host: "DNS / IP:PORT",
      user: process.argv[3],
      password: process.argv[4]
    }
).createCredential(require('./' + process.argv[2]), function (res) {
    console.log(res.consumerKey, res.consumerSecret)
})
EOF

npm install git+https://github.com/aljvilla/wso2-appgen.git --save
node appgen.js module.json usser pass > keysecret

cat << EOF > config.json
{
  "wso2":{
    "consumerkey":    "$(cat tmp/keysecret | awk '{print $1}')",
    "consumersecret": "$(cat tmp/keysecret | awk '{print $2}')"
  }
}
EOF

```