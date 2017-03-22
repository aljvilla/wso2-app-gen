/** 
 * @author Manuel Villafañe <mvillafane@conicyt.cl>
 * @file lib/wso2Config
 * @module lib/wso2Config
 */

/** @constant
    @type {object}
    @default
*/
const request = require('request')

/** @constant
    @type {object}
    @default
*/
const jsonParser = require('json-parser')

/** @constant
    @type {object}
    @default
*/
const path = require('path')

/** @constant
    @type {object}
    @default
*/
const fs = require('fs')

/** @constant
    @type {object}
    @default
*/
const async         = require('async') 

/** @constant
    @type {string}
    @default
*/
const loginUrl = '/store/site/blocks/user/login/ajax/login.jag'

/** @constant
    @type {string}
    @default
*/
const checkApisUrl = '/store/site/blocks/search/api-search/ajax/search.jag'

/** @constant
    @type {string}
    @default
*/
const checkAppsUrl = '/store/site/blocks/application/application-list/ajax/application-list.jag?action=getApplications'

/** @constant
    @type {string}
    @default
*/
const createAppsUrl = '/store/site/blocks/application/application-add/ajax/application-add.jag'

/** @constant
    @type {string}
    @default
*/
const subscribeApisUrl = '/store/site/blocks/subscription/subscription-add/ajax/subscription-add.jag'

/** @constant
    @type {string}
    @default
*/
const generateKeyAppUrl = '/store/site/blocks/subscription/subscription-add/ajax/subscription-add.jag'

/** @constant
    @type {string}
    @default
*/
const listSubscriptionsAppUrl = '/store/site/blocks/subscription/subscription-list/ajax/subscription-list.jag?action=getAllSubscriptions'



process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

module.exports = wso2Config

function wso2Config(conf) {
	if(!conf.host) throw new Error('Debe especificar el HOST de WSO2')
	this.host = conf.host
	
	if(!conf.user) throw new Error('Debe especificar el usuario de WSO2')
	this.user = conf.user

	if(!conf.password) throw new Error('Debe especificar una clave de WSO2')
	this.pass = conf.password

	this.debug = conf.debug || false
}

wso2Config.prototype.createCredential = function (app, callback) {
	var cookie            = null
	var host              = this.host
	var user              = this.user
	var pass              = this.pass
	var site              = this.site
	var app               = app
	var debug             = this.debug
	var apisNames         = {}
	var appConsumerKey    = null
	var appConsumerSecret = null
	var appData           = null
	var pathLog           = path.dirname(require.main.filename) + '/wso2AppGen.log'

	async.waterfall(
		[
			getCookie,
			checkApis,
			checkApps,
			createApp,
			generateKeyApp,
			getAllSubscriptions,
			subscribeApis

		],
		function (err, result) {
			if(err) callback(err)
			else callback(result)
		}
	)


	/** @function 
		@description Escribe las salidas de los log del script
	*/
	function writeLog(strLog) {
		fs.appendFile(pathLog, strLog + "\n", function(err) {
			if(err) return console.log(err)			
		})		
	}

	/** @function 
		@description Obtiene un token para poder acceder a WSO2
		@param {function} callback Recibe como parametro una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {function} callback
	*/
	function getCookie(callback) {
		writeLog("\n______________________________________________________________________________\n")
		const rqConf = {
			agent: false,
			// rejectUnauthorized:false,
			uri: `${host}${loginUrl}`,
			method: 'POST',
			form: {
				action: "login",
                username: user,
                password: pass,
                tenant: null
			}
		}

		if(debug) writeLog('Obteniendo una cookie')

		try {
			request(rqConf, function (error, response, body) {
				if(error) throw new Error('Datos del host incorrectos, verifique que el Host, User y Password sean correctos.')
				else{
					const objResponse = jsonParser.parse(body)
					if(objResponse.error) throw new Error(objResponse.message)
					else{
						cookie = response.headers['set-cookie'][0]
						callback(null, 0)
					}
				}
			})
		}catch (err){
			throw new Error('Datos del host incorrectos, verifique que el Host, User y Password sean correctos.')
		}
	}

	/** @function 
		@description Verifica que las apis se encuentren definidas en WSO2
		@param {function} callback Recibe como parametro un numero y una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {function} callback
	*/
	function checkApis(pos, callback) {
		if(app.dependencies === undefined) callback(null)
		else if(pos > app.dependencies.length-1) callback(null)
		else{
			const api = app.dependencies[pos]
			const rqConf = {
				// rejectUnauthorized:false,
				url: `${host}${checkApisUrl}`,
				headers: {
		            Cookie: cookie,
		        },
				method: 'POST',
				form: {
					action: 'searchAPIs',
					query: api.apiName,
					start: 0,
					end: 100
				}
			}

			if(debug) writeLog(`Consultando la api: "${api.apiName}"`)

			try{
				request(rqConf, function (error, response, body) {
					if(error) throw new Error(error)
					else{
							const objResponse = jsonParser.parse(body)
							pos += 1
							if(objResponse.result.length === 0) throw new Error(`No se encontró la API "${api.apiName}"`)
							
							var findApi = null
							objResponse.result.forEach(function (item) {
								if(item.name === api.apiName) findApi = item
							})
							apisNames[api.apiName] = findApi
							checkApis(pos, callback)
					}
				})
			}catch (err){
				throw new Error(err)
			}
		}
	}

	/** @function 
		@description Verifica si aplicacion existe, sino la crea
		@param {function} callback Recibe como parametro una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {number} callback
		@returns {function} callback
	*/
	function checkApps(callback) {
		var result = true
		const rqConf = {
			// rejectUnauthorized:false,
			url: `${host}${checkAppsUrl}`,
			headers: {
	            Cookie: cookie,
	        },
			method: 'GET'				
		}

		if(debug) writeLog(`Chequeando si existe la App: "${app.name}"`)

		try{
			request(rqConf, function (error, response, body) {
				if(error) throw new Error(error)
				else{
					const objResponse = jsonParser.parse(body)
					if(objResponse.error) throw new Error(objResponse.message)
					else{
						if(objResponse.applications.length === 0) throw new Error('No se encontraron apps creadas en WSO2')
						objResponse.applications.forEach(function (item) {
							if(item.name === app.name) result = false
						})
						callback(null, result)
					}
				}
			})			
		}catch (err){
			throw new Error(err)
		}
	}

	/** @function 
		@description Crea la app en caso que no exista
		@param {function} callback Recibe como parametro un true o false y una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {boolean} callback
		@returns {function} callback
	*/
	function createApp(create, callback) {
		if(!create) callback(null, false)
		else{
			const rqConf = {
				url: `${host}${createAppsUrl}`,
				headers: {
		            Cookie: cookie,
		        },
				method: 'POST',
				form: {
					action: 'addApplication',
					application: app.name,
					tier: app.tokenTier || 'Unlimited',
					description: app.description || '',
					callbackUrl: app.oauth2CallbackUrl || ''
				}
			}


			if(debug) writeLog(`Creando la App: "${app.name}"`)

			try{
				request(rqConf, function (error, response, body) {
					if(error) throw new Error(error)
					else{
							const objResponse = jsonParser.parse(body)
							if(objResponse.error) throw new Error(`No se encontró la API "${objResponse.message}"`)
							callback(null, true)
					}
				})
			}catch (err){
				throw new Error(err)
			}
		}		
	}


	/** @function 
		@description Genera las credenciales de la app
		@param {function} callback Recibe como parametro un true o false y una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {boolean} callback
		@returns {function} callback
	*/
	function generateKeyApp(generate, callback) {
		if(!generate) callback(null)
		else{
			const rqConf = {
				url: `${host}${generateKeyAppUrl}`,
				headers: {
		            Cookie: cookie,
		        },
				method: 'POST',
				form: {
					action: 'generateApplicationKey',
					application: app.name,
					keytype: 'PRODUCTION',
					callbackUrl: app.oauth2CallbackUrl || '',
					authorizedDomains: 'ALL',
					validityTime: 360000
				}
			}			

			if(debug) writeLog(`Generando Key para la App: "${app.name}"`)

			try{
				request(rqConf, function (error, response, body) {
					if(error) throw new Error(error)
					else{
							const objResponse = jsonParser.parse(body)
							if(objResponse.error) throw new Error(`No se pudo generar la Key para la App "${app.name}" ${objResponse.message}`)
							
							appConsumerKey = objResponse.data.key.consumerKey
							appConsumerSecret = objResponse.data.key.consumerSecret
							callback(null)
					}
				})
			}catch (err){
				throw new Error(err)
			}
		}
	}


	/** @function 
		@description Busca los datos de la app que se a creado
		@param {function} callback Recibe como parametro un true o false y una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {boolean} callback
		@returns {function} callback
	*/
	function getAllSubscriptions(callback) {
		const rqConf = {
			// rejectUnauthorized:false,
			url: `${host}${listSubscriptionsAppUrl}`,
			headers: {
	            Cookie: cookie,
	        },
			method: 'GET'				
		}

		try{
			request(rqConf, function (error, response, body) {
				if(error) throw new Error(error)
				else{
						const objResponse = jsonParser.parse(body)
						if(objResponse.error) throw new Error(`Error al obtener los datos de la app ${objResponse.message}`)
						
						objResponse.subscriptions.applications.forEach(function (item) {
							if(app.name === item.name) appData = item
						})
						appConsumerKey = appConsumerKey || appData.prodConsumerKey
						appConsumerSecret = appConsumerSecret || appData.prodConsumerSecret
						callback(null, 0)
				}
			})
		}catch (err){
			throw new Error(err)
		}
	}


	/** @function 
		@description Hace las suscripcion de las apis
		@param {function} callback Recibe como parametro un true o false y una función callback, la cual se invoca para continuar a la siguiente función o gatillar un error
		@returns {boolean} callback
		@returns {function} callback
	*/
	function subscribeApis(pos, callback) {
		if(app.dependencies === undefined) callback(null, {consumerKey: appConsumerKey ,consumerSecret: appConsumerSecret})
		else if(pos > app.dependencies.length-1) callback(null, {consumerKey: appConsumerKey ,consumerSecret: appConsumerSecret})
		else{
			const api = app.dependencies[pos]
			const rqConf = {
				url: `${host}${subscribeApisUrl}`,
				headers: {
		            Cookie: cookie,
		        },
				method: 'POST',
				form: {
					action: 'addSubscription',
					name: api.apiName,
					version: api.apiVersion,
					provider: apisNames[api.apiName].provider,
					tier: api.tier || 'Unlimited',
					applicationId: appData.id,

				}
			}

			if(debug) writeLog(`Suscribiendo la App "${app.name}" a la Api "${api.apiName} ${api.apiVersion}"`)

			try{
				request(rqConf, function (error, response, body) {
					if(error) throw new Error(error)
					else{
							const objResponse = jsonParser.parse(body)
							if(objResponse.error && objResponse.message.indexOf('Subscription already exists') != undefined && objResponse.message.indexOf('Subscription already exists') === -1) throw new Error(`\nERROR DE SUSCRIPCIÓN: App "${app.name}"  Api "${api.apiName} ${api.apiVersion}"\n${objResponse.message}\n`)
							pos += 1
							subscribeApis(pos, callback)
					}
				})
			}catch (err){
				throw new Error(err)
			}
		}
	}
}