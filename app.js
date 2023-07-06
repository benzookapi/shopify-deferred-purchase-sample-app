'use strict';

const Koa = require('koa');
const cors = require('@koa/cors');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const koaRequest = require('koa-http-request');
const views = require('koa-views');
const serve = require('koa-static');

const crypto = require('crypto');

const mongo = require('mongodb');
const { Client } = require('pg');
const mysql = require('mysql');

const jwt_decode = require('jwt-decode'); // For client side JWT with no signature validation
const jwt = require('jsonwebtoken'); // For server side JWT with app secret signature validation

//const { v4: uuidv4 } = require('uuid'); // For JWT sign

const router = new Router();
const app = module.exports = new Koa();

app.use(cors()); // For Web Worker sandox access

app.use(bodyParser());

app.use(koaRequest({

}));

app.use(views(__dirname + '/views', {
  map: {
    html: 'underscore'
  }
}));

app.use(serve(__dirname + '/public'));

// Shopify API info.
const API_KEY = `${process.env.SHOPIFY_API_KEY}`;
const API_SECRET = `${process.env.SHOPIFY_API_SECRET}`;
const API_VERSION = `${process.env.SHOPIFY_API_VERSION}`;
const API_SCOPES = `${process.env.SHOPIFY_API_SCOPES}`;

const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_FORM = 'application/x-www-form-urlencoded';

const GRAPHQL_PATH_ADMIN = `admin/api/${API_VERSION}/graphql.json`;

const UNDEFINED = 'undefined';

// Admin path signature secret
const HMAC_SECRET = API_SECRET;

// DB type for data store
const DB_TYPE = `${process.env.SHOPIFY_DB_TYPE}`;

// Mongo Settings
const MONGO_URL = `${process.env.SHOPIFY_MONGO_URL}`;
const MONGO_DB_NAME = `${process.env.SHOPIFY_MONGO_DB_NAME}`;
const MONGO_COLLECTION = 'shops';

// PostgreSQL Settings
const POSTGRESQL_URL = `${process.env.SHOPIFY_POSTGRESQL_URL}`;
const POSTGRESQL_TABLE = 'shops';

// MySQL Settings
const MYSQL_HOST = `${process.env.SHOPIFY_MYSQL_HOST}`;
const MYSQL_USER = `${process.env.SHOPIFY_MYSQL_USER}`;
const MYSQL_PASSWORD = `${process.env.SHOPIFY_MYSQL_PASSWORD}`;
const MYSQL_DATABASE = `${process.env.SHOPIFY_MYSQL_DATABASE}`;
const MYSQL_TABLE = 'shops';

/* --- App top URL reigstered as the base one in the app settings in partner dashbord. --- */
// See https://shopify.dev/apps/auth/oauth/getting-started
// See https://shopify.dev/apps/best-practices/performance/admin
// See https://shopify.dev/apps/tools/app-bridge/updating-overview#ensure-compatibility-with-the-new-shopify-admin-domain
router.get('/', async (ctx, next) => {
  console.log("+++++++++++++++ / +++++++++++++++");
  if (!checkSignature(ctx.request.query)) {
    ctx.status = 400;
    return;
  }

  const shop = ctx.request.query.shop;

  let shop_data = null;
  let api_res = null;
  try {
    shop_data = await (getDB(shop));
    let install = false;
    if (shop_data == null) {
      console.log("No shop data");
      install = true;
    } else {
      try {
        api_res = await (callGraphql(ctx, shop, `{
        shop {
          name
        }
        app {
          handle
         }
      }`, null, GRAPHQL_PATH_ADMIN, null));
      } catch (e) { }
      if (api_res == null || typeof api_res.data.shop.name === UNDEFINED) {
        console.log("The stored access token is invalid");
        install = true;
      }
    }
    if (install) {
      // See https://shopify.dev/apps/auth/oauth/getting-started
      const redirectUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${API_SCOPES}&redirect_uri=https://${ctx.request.host}/callback&state=&grant_options[]=`;
      //const redirectUrl = `https://${getAdminFromShop(shop)}/oauth/authorize?client_id=${API_KEY}&scope=${API_SCOPES}&redirect_uri=https://${ctx.request.host}/callback&state=&grant_options[]=`;
      console.log(`Redirecting to ${redirectUrl} for OAuth flow...`);
      ctx.redirect(redirectUrl);
      return;
    }
  } catch (e) {
    ctx.status = 500;
    return;
  }

  // See https://shopify.dev/apps/store/security/iframe-protection
  setContentSecurityPolicy(ctx, shop);
  await ctx.render('index', {});

});

/* --- Callback URL redirected by Shopify after the authentication which needs to be registered as the while listed URL in the app settings in partner dashboard. --- */
// See https://shopify.dev/apps/auth/oauth/getting-started
router.get('/callback', async (ctx, next) => {
  console.log("+++++++++++++++ /callback +++++++++++++++");
  if (!checkSignature(ctx.request.query)) {
    ctx.status = 400;
    return;
  }
  let req = {};
  req.client_id = API_KEY;
  req.client_secret = API_SECRET;
  req.code = ctx.request.query.code;

  const shop = ctx.request.query.shop;

  let res = null;
  try {
    // API endpoints including this access token one keep the myshopify.com domains.
    res = await (accessEndpoint(ctx, `https://${shop}/admin/oauth/access_token`, req, null, CONTENT_TYPE_FORM));
    if (typeof res.access_token === UNDEFINED) {
      ctx.status = 500;
      return;
    }
  } catch (e) {
    ctx.status = 500;
    return;
  }

  getDB(shop).then(function (shop_data) {
    if (shop_data == null) {
      insertDB(shop, res).then(function (r) { }).catch(function (e) { });
    } else {
      setDB(shop, res).then(function (r) { }).catch(function (e) { });
    }
  }).catch(function (e) {
    ctx.status = 500;
    return;
  });

  let api_res = null;
  try {
    api_res = await (callGraphql(ctx, shop, `{
        app {
          handle
         }
      }`, res.access_token, GRAPHQL_PATH_ADMIN, null));
  } catch (e) { }

  // See https://shopify.dev/apps/auth/oauth/update
  // Do server side redirection because this is NOT embedded ("embedded" parameter is not passed).
  // See https://shopify.dev/apps/tools/app-bridge/updating-overview#ensure-compatibility-with-the-new-shopify-admin-domain
  ctx.redirect(`https://${getAdminFromShop(shop)}/apps/${api_res.data.app.handle}`);

});

/* --- Plan create / update CORS endpoint --- */
// Sandbox Web Workers used by Admin UI Extensions requires CORS access.
/* Accessed like this from Web Workers.
fetch(`https://fb34-2400-2410-2fc0-fb00-d4e2-f57f-90a6-bdd6.jp.ngrok.io/create?your_key=your_value&token=YOUR_SESSION_TOKEN`, {
      method: "POST"
    }).then(res => {
      res.json().then(json => {
        console.log(`${JSON.stringify(json)}`);
      }).catch(e => {
        console.log(`${e}`);
      });
    }).catch(e => {
      console.log(`error: ${e}`);
    });
*/
router.post('/plans', async (ctx, next) => {
  console.log("------------ plans ------------");
  console.log(`request ${JSON.stringify(ctx.request, null, 4)}`);
  console.log(`query ${JSON.stringify(ctx.request.query, null, 4)}`);
  console.log(`body ${JSON.stringify(ctx.request.body, null, 4)}`);

  // if a wrong token is passed with a ummatched signature, decodeJWT fails with an exeption = works as verification as well.
  let decoded_token = null;
  try {
    decoded_token = decodeJWT(ctx.request.query.token);
  } catch (e) {
    console.log(`${e}`);
  }
  if (decoded_token == null) {
    ctx.body = { "Error": "Wrong token passed." };
    ctx.status = 400;
    return;
  }
  console.log(`decoded_token ${JSON.stringify(decoded_token, null, 4)}`);

  const shop = getShopFromAuthToken(ctx.request.query.token);

  const event = typeof ctx.request.query.event === UNDEFINED ? '' : ctx.request.query.event;

  const product_id = ctx.request.query.product_id;
  const variant_id = ctx.request.query.variant_id;
  const group_id = ctx.request.query.group_id;
  const variants = ctx.request.query.variants;

  const title = ctx.request.query.title;
  const days = parseInt(ctx.request.query.days);

  // See https://shopify.dev/docs/apps/selling-strategies/subscriptions/selling-plans/manage
  let ql = ``;
  let variables = null;
  switch (event) {
    case 'add':
      // TBD
      break;
    case 'create':
      // Create a selling plan group to save the merchant's generated selling plans.
      // See https://shopify.dev/docs/api/admin-graphql/unstable/mutations/sellingPlanGroupCreate
      ql = `mutation sellingPlanGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput!) {
          sellingPlanGroupCreate(input: $input, resources: $resources) {
            sellingPlanGroup {
              id
              name
            }
            userErrors {
              field
              message
            }
            }
        }`;
      variables = {
        "input": {
          "merchantCode": "my-subscription",
          "name": "My Subscription",
          "options": [
            "My Daily Option 1"
          ],
          "position": 1,
          "sellingPlansToCreate": [
            {
              "name": title,
              "options": "1 Day(s)",
              "position": 1,
              "category": "SUBSCRIPTION",
              "billingPolicy": {
                "recurring": {
                  "interval": "DAY",
                  "intervalCount": days
                }
              },
              "deliveryPolicy": {
                "recurring": {
                  "interval": "DAY",
                  "intervalCount": days,
                  "preAnchorBehavior": "ASAP",
                  "cutoff": 0,
                  "intent": "FULFILLMENT_BEGIN"
                }
              },
              "pricingPolicies": [
              ]
            }
          ],
          "sellingPlansToDelete": [
          ],
          "sellingPlansToUpdate": [
          ]
        },
        "resources": {
          "productIds": [
            product_id
          ],
          "productVariantIds": (variant_id === '' ? [] : [variant_id])
        }
      };
      break;
    case 'remove':
      //TBD
      break;
    case 'edit':
      //TBD
      break;
    default:
      // By default, show the current plan.
      // See https://shopify.dev/docs/api/admin-graphql/unstable/queries/sellingPlanGroup
      ql = `{
          sellingPlanGroup(id: "${group_id}") {
            appId
            id
            name
            sellingPlans(first: 10) {
              edges {
                node {
                  id
                  name
                  billingPolicy {
                    ... on SellingPlanRecurringBillingPolicy {
                      interval
                      intervalCount
                      anchors {
                        cutoffDay
                        day
                        month
                        type
                      }
                    }
                  }
                  deliveryPolicy {
                    ... on SellingPlanRecurringDeliveryPolicy {
                      anchors {
                        cutoffDay
                        day
                        month
                        type
                      }
                    }
                  }
                }
              }
            }

          }
        }`;
  }
  let response_data = {};
  try {
    const api_res = await (callGraphql(ctx, shop, ql, null, GRAPHQL_PATH_ADMIN, variables));
    response_data = api_res.data;
  } catch (e) {
    console.log(`${JSON.stringify(e)}`);
  }

  ctx.set('Content-Type', 'application/json');
  ctx.body = response_data;
  ctx.status = 200;

});

// Subscription admin link
// See https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create
// See https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/update
router.get('/subscriptions', async (ctx, next) => {
  console.log("+++++++++++++++ /subscriptions +++++++++++++++");
  console.log(`query ${JSON.stringify(ctx.request.query, null, 4)}`);

  // Access by AppBride::authenticatedFetch
  if (typeof ctx.request.header.authorization !== UNDEFINED) {
    console.log('Authenticated fetch');
    const token = getTokenFromAuthHeader(ctx);
    if (!checkAuthFetchToken(token)[0]) {
      ctx.body.result.message = "Signature unmatched. Incorrect authentication bearer sent";
      ctx.status = 400;
      return;
    }

    ctx.set('Content-Type', 'application/json');
    ctx.body = {
      "result": {
        "message": "",
        "response": {}
      }
    };

    const shop = getShopFromAuthToken(token);
    const id = ctx.request.query.id;
    const billing = typeof ctx.request.query.billing !== UNDEFINED && ctx.request.query.billing === 'true' ? true : false;
    const fulfill = typeof ctx.request.query.fulfill !== UNDEFINED && ctx.request.query.fulfill === 'true' ? true : false;

    let shop_data = null;
    try {
      shop_data = await (getDB(shop));
      if (shop_data == null) {
        ctx.body.result.message = "Authorization failed. No shop data";
        ctx.status = 400;
        return;
      }
    } catch (e) {
      ctx.body.result.message = "Internal error in retrieving shop data";
      ctx.status = 500;
      return;
    }

    // Get the subscription contract of the given id.
    // See https://shopify.dev/docs/api/admin-graphql/unstable/objects/SubscriptionContract
    const contract_ql = `{
      subscriptionContract(id: "gid://shopify/SubscriptionContract/${id}"){
        id
        billingPolicy {
          interval
          intervalCount
          maxCycles
          minCycles
        }
        customer {
            id
            email
            firstName
            lastName
        }
        customerPaymentMethod {
            id
            instrument {
              ... on CustomerCreditCard {
                brand
                maskedNumber
                name
                source
              }
            }
        }
        deliveryMethod {
          ... on SubscriptionDeliveryMethodShipping {
            address {
              address1
              address2
              city
              company
              country
              countryCode
              firstName
              lastName
              name
              phone
              province
              provinceCode
              zip
            }
          }
        }
        deliveryPolicy {
            interval
            intervalCount
            anchors {
              cutoffDay
              day
              month
              type
            }
        }
        lastPaymentStatus
        nextBillingDate
        status
        billingAttempts(first: 3, reverse: true) {
          edges {
            node {
              id
              nextActionUrl
              createdAt
              errorCode
              errorMessage
              idempotencyKey
              ready
            }
          }
        }
        orders(first: 3, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              fulfillmentOrders(first: 3, reverse: true) {
                edges {
                  node {
                    id
                    createdAt
                    status
                    requestStatus
                  }
                }
              }
            }
          }
        } 
        lines(first: 3, reverse: true) {
          edges {
            node {
              id
              title
              variantTitle
            }
          }
        }                
      }
    }
    `;
    let ql = contract_ql;
    // Make a billing attempt to create an order with the given contract above.
    // See https://shopify.dev/docs/api/admin-graphql/unstable/mutations/subscriptionBillingAttemptCreate
    if (billing) {
      ql = `mutation {
        subscriptionBillingAttemptCreate(
          subscriptionContractId: "gid://shopify/SubscriptionContract/${id}"
          subscriptionBillingAttemptInput: {
            idempotencyKey: "mysub${new Date().getTime()}${(Math.random() * 10 ^ 16) % 16}"
            originTime: "${new Date().toISOString()}"
          }
        )
        {
          subscriptionBillingAttempt {
            id
            originTime
            errorCode
            errorMessage
            idempotencyKey
            nextActionUrl
            order {
              id
            }
            ready
            subscriptionContract {
              id
              orders(first: 3, reverse: true) {
                edges {
                  node {
                    id
                    name
                    createdAt
                    physicalLocation {
                      id
                    }
                    fulfillable
                    fulfillments (first: 3) {
                      id
                      location {
                        id
                      }
                    }
                    fulfillmentOrders(first: 3, reverse: true) {
                      edges {
                        node {
                          id
                          createdAt
                          status
                          requestStatus
                        }
                      }
                    }
                  }
                }
              } 
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;
    }
    let api_res = null;
    try {
      api_res = await (callGraphql(ctx, shop, ql, null, GRAPHQL_PATH_ADMIN, null));
      // Ship automatically if checked.
      if (fulfill) {
        // Get the latest fullfillment order id with the same query above (the billing attempt mutation response has the old ones only...).
        // New order creation has some delay, so this demo use dummy delay process (DO NOT THIS FOR REAL PRODUCTION APPS!)
        const delay = () => { return new Promise((r) => { setTimeout(r, 3 * 1000) }) };
        console.log(`----- Starting a dummy delay... -----`);
        await delay();
        const api_res1 = await (callGraphql(ctx, shop, contract_ql, null, GRAPHQL_PATH_ADMIN, null));
        const fulfill_order_id = api_res1.data.subscriptionContract.orders.edges[0].node.fulfillmentOrders.edges[0].node.id;
        // Create a fullfilment of the given  fullfillment order id for automatic shipping.
        const api_res2 = await (callGraphql(ctx, shop, `mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
          fulfillmentCreateV2(fulfillment: $fulfillment) {
            fulfillment {
              id
              name
              fulfillmentOrders(first: 3, reverse: true) {
                edges {
                  node {
                    id
                    createdAt
                    status
                    requestStatus
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`, null, GRAPHQL_PATH_ADMIN, {
          "fulfillment": {
            "lineItemsByFulfillmentOrder": [
              {
                "fulfillmentOrderId": fulfill_order_id
              }
            ],
            "trackingInfo": {
              "company": "Dummy shipping carrier",
              "number": "9999999",
              "url": "https://example.com"
            }
          }
        }));
        ctx.body.result.response2 = api_res2;
      }
    } catch (e) {
      console.log(`${JSON.stringify(e)}`);
      ctx.body.result.message = JSON.stringify(e);
    }

    ctx.body.result.response = api_res;
    ctx.status = 200;
    return;
  }

  if (!checkSignature(ctx.request.query)) {
    ctx.status = 400;
    return;
  }

  const shop = ctx.request.query.shop;
  setContentSecurityPolicy(ctx, shop);
  await ctx.render('index', {});

});


/* --- App proxies endpoint for subscription customer portal --- */
// See https://shopify.dev/apps/online-store/app-proxies
// Note that ngrok blocks the proxy by default, you have to use other platforms like Render, Fly.io, etc.
router.get('/appproxy', async (ctx, next) => {
  console.log("+++++++++++++++ /appproxy +++++++++++++++");
  console.log(`request ${JSON.stringify(ctx.request, null, 4)}`);
  if (!checkAppProxySignature(ctx.request.query)) {
    ctx.status = 400;
    return;
  }

  let decoded_token = null;
  if (typeof ctx.request.query.token !== UNDEFINED) {
    // if a wrong token is passed with a ummatched signature, decodeJWT fails with an exeption = works as verification as well.
    try {
      decoded_token = decodeJWT(ctx.request.query.token);
    } catch (e) {
      console.log(`${e}`);
    }
    if (decoded_token == null) {
      ctx.body = { "Error": "Wrong token passed." };
      ctx.status = 400;
      return;
    }
    console.log(`decoded_token ${JSON.stringify(decoded_token, null, 4)}`);
  }

  const shop = ctx.request.query.shop;
  const customer_id = ctx.request.query.logged_in_customer_id;

  const event = typeof ctx.request.query.event !== UNDEFINED ? ctx.request.query.event : '';
  if (event === 'send') {
    const email = typeof ctx.request.query.email !== UNDEFINED ? ctx.request.query.email : '';
    const api_res = await (callGraphql(ctx, shop, `{
      customers(query: "email:'${email}'", first: 1) {
        edges {
          node {
            id
            email
            firstName
            lastName
          }
        }
      }
    }`, null, GRAPHQL_PATH_ADMIN, null));
    const id = api_res.data.customers.edges.length > 0 ? api_res.data.customers.edges[0].node.id : '';
    if (id === '') {
      ctx.body = { "Error": "Wrong email passed." };
      ctx.status = 404;
      return;
    }
    const token = createJWT({
      "id": id
    });
    ctx.body = {
      "link": `https://${shop}/apps/mysubpage?event=show&token=${token}`
    };
    return;
  }
  if (event === 'show') {
    if (decoded_token == null && customer_id === '') {
      ctx.body = { "Error": "No token passed, or not logged in." };
      ctx.status = 400;
      return;
    }
    const id = decoded_token != null ? decoded_token.id : `gid://shopify/Customer/${customer_id}`;
    const api_res = await (callGraphql(ctx, shop, `{
      customer(id: "${id}") {
        id
        firstName
        lastName
        email
        subscriptionContracts(first: 3, reverse: true) {
          edges {
            node {
              app {
                title
              }
              customerPaymentMethod {
                id
                instrument {
                  ... on CustomerCreditCard {
                    brand
                    maskedNumber
                  }
                }
              }
              lastPaymentStatus
              nextBillingDate
              orders(first: 3, reverse: true) {
                edges {
                  node {
                    name
                    createdAt
                    totalPriceSet {
                      presentmentMoney {
                        amount
                        currencyCode
                      }
                    }   
                    lineItems(first: 3) {
                      edges {
                        node {
                          name
                          quantity
                        }
                      }
                    } 
                    shippingAddress {
                      address1
                      address2
                      city
                      province
                      provinceCode
                      zip
                      company
                      country
                      countryCodeV2
                      firstName
                      lastName
                      phone
                    }      
                    fulfillments(first: 3) {
                      status
                      trackingInfo(first: 3) {
                        company
                        number
                        url
                      }
                    }                    
                  }
                }
              }
            }
          }
        }
      }
    }`, null, GRAPHQL_PATH_ADMIN, null));
    return await ctx.render('mypage', {
      app_url: `https://${ctx.request.host}`,
      json: api_res.data,
      token: createJWT({
        "payment_method_id": api_res.data.customer.subscriptionContracts.edges.length > 0 ? api_res.data.customer.subscriptionContracts.edges[0].node.customerPaymentMethod.id : ''
      })
    });
  }
  if (event === 'email') {
    const payment_method_id = decoded_token.payment_method_id;
    if (payment_method_id === '') {
      ctx.body = { "Error": "No payment_method_id passed." };
      ctx.status = 400;
      return;
    }
    const api_res = await (callGraphql(ctx, shop, `mutation {
      customerPaymentMethodSendUpdateEmail(customerPaymentMethodId: "${payment_method_id}") {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
     }`, null, GRAPHQL_PATH_ADMIN, null));
    if (api_res.data.customerPaymentMethodSendUpdateEmail.userErrors.length > 0) {
      ctx.body = { "Error": `${JSON.stringify(api_res.data.customerPaymentMethodSendUpdateEmail.userErrors)}` };
      return;
    } else {
      ctx.body = { "Success": `${api_res.data.customerPaymentMethodSendUpdateEmail.customer.email}` };
      return;
    }
  }
  if (event === 'update') {
    const payment_method_id = decoded_token.payment_method_id;
    if (payment_method_id === '') {
      ctx.body = { "Error": "No payment_method_id passed." };
      ctx.status = 400;
      return;
    }
    const api_res = await (callGraphql(ctx, shop, `mutation {
      customerPaymentMethodGetUpdateUrl(customerPaymentMethodId: "${payment_method_id}") {
        updatePaymentMethodUrl
        userErrors {
          code
          field
          message
        }
      }
     }`, null, GRAPHQL_PATH_ADMIN, null));
    if (api_res.data.customerPaymentMethodGetUpdateUrl.userErrors.length > 0) {
      ctx.body = { "Error": `${JSON.stringify(api_res.data.customerPaymentMethodGetUpdateUrl.userErrors)}` };
      return;
    } else {
      ctx.body = { "Success": `${api_res.data.customerPaymentMethodGetUpdateUrl.updatePaymentMethodUrl}` };
      return;
    }
  }

  ctx.body = { "Error": "No matched events" };
  ctx.status = 400;

});


/* --- Webhook endpoint for  GDPR --- */
router.post('/webhookgdpr', async (ctx, next) => {
  console.log("*************** webhookgdpr ***************");
  console.log(`*** body *** ${JSON.stringify(ctx.request.body)}`);

  /* Check the signature */
  const valid = await (checkWebhookSignature(ctx, API_SECRET));
  if (!valid) {
    console.log('Not a valid signature');
    ctx.status = 401;
    return;
  }

  ctx.status = 200;
});

/* --- Check if the given signature is correct or not --- */
// See https://shopify.dev/apps/auth/oauth/getting-started#step-2-verify-the-installation-request
const checkSignature = function (json) {
  let temp = JSON.parse(JSON.stringify(json));
  console.log(`checkSignature ${JSON.stringify(temp)}`);
  if (typeof temp.hmac === UNDEFINED) return false;
  let sig = temp.hmac;
  delete temp.hmac;
  let msg = Object.entries(temp).sort().map(e => e.join('=')).join('&');
  //console.log(`checkSignature ${msg}`);
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(msg);
  let signature = hmac.digest('hex');
  console.log(`checkSignature ${signature}`);
  return signature === sig ? true : false;
};

/* --- Check if the given signature is correct or not for app proxies --- */
// See https://shopify.dev/apps/online-store/app-proxies#calculate-a-digital-signature
const checkAppProxySignature = function (json) {
  let temp = JSON.parse(JSON.stringify(json));
  console.log(`checkAppProxySignature ${JSON.stringify(temp)}`);
  if (typeof temp.signature === UNDEFINED) return false;
  let sig = temp.signature;
  delete temp.signature;
  let msg = Object.entries(temp).sort().map(e => e.join('=')).join('');
  //console.log(`checkAppProxySignature ${msg}`);
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(msg);
  let signarure = hmac.digest('hex');
  console.log(`checkAppProxySignature ${signarure}`);
  return signarure === sig ? true : false;
};

/* --- Check if the given signarure is corect or not for Webhook --- */
// See https://shopify.dev/apps/webhooks/configuration/https#step-5-verify-the-webhook
const checkWebhookSignature = function (ctx, secret) {
  return new Promise(function (resolve, reject) {
    console.log(`checkWebhookSignature Headers ${JSON.stringify(ctx.headers)}`);
    let receivedSig = ctx.headers["x-shopify-hmac-sha256"];
    console.log(`checkWebhookSignature Given ${receivedSig}`);
    if (receivedSig == null) return resolve(false);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(Buffer.from(ctx.request.rawBody, 'utf8').toString('utf8'));
    let signature = hmac.digest('base64');
    console.log(`checkWebhookSignature Created: ${signature}`);
    return resolve(receivedSig === signature ? true : false);
  });
};

/* --- Get a token string from a given authorization header --- */
// See https://shopify.dev/apps/auth/oauth/session-tokens/getting-started#step-2-authenticate-your-requests
const getTokenFromAuthHeader = function (ctx) {
  return ctx.request.header.authorization.replace('Bearer ', '');
};

/* --- Get a shop from a token from a given authorization header --- */
// See https://shopify.dev/apps/auth/oauth/session-tokens/getting-started#optional-obtain-session-details-and-verify-the-session-token-manually
const getShopFromAuthToken = function (token) {
  const payload = jwt_decode(token);
  console.log(`payload: ${JSON.stringify(payload, null, 4)}`);
  return payload.dest.replace('https://', '');
};

/* --- Check if the given signarure is corect or not for App Bridge authenticated requests --- */
// See https://shopify.dev/apps/auth/oauth/session-tokens/getting-started#verify-the-session-tokens-signature
const checkAuthFetchToken = function (token) {
  const [header, payload, signature] = token.split("\.");
  console.log(`checkAuthFetchToken header: ${header} payload: ${payload} signature: ${signature}`);
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(`${header}.${payload}`);
  const encodeBase64 = function (b) { return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') };
  let sig = encodeBase64(hmac.digest('base64'));
  console.log(`checkAuthFetchToken Recieved: ${signature} Created: ${sig}`);
  return [(signature === sig ? true : false), sig];
};

/* --- Whether the given request is embedded inside Shopify Admin or not --- */
// See. https://shopify.dev/apps/auth/oauth/getting-started#check-for-and-escape-the-iframe-embedded-apps-only
const isEmbedded = function (ctx) {
  const embedded = ctx.request.query.embedded;
  // If the app is set embedded in the app settings, "embedded" is set "1", otherwise "0" or undefined.  
  if (typeof embedded !== UNDEFINED && embedded == '1') return true;
  return false;
};

/* --- Get the id from shop domain --- */
const getIdFromShop = function (shop) {
  return shop.replace('.myshopify.com', '');
};

/* --- Get Admin domain and path from shop domain --- */
// See https://shopify.dev/apps/tools/app-bridge/updating-overview#ensure-compatibility-with-the-new-shopify-admin-domain
// See https://www.shopify.com/partners/blog/september-product-updates-for-partners-and-developers
const getAdminFromShop = function (shop) {
  return `admin.shopify.com/store/${getIdFromShop(shop)}`;
};

/* --- Set Content-Security-Policy header for admin embedded types --- */
// See https://shopify.dev/apps/store/security/iframe-protection
const setContentSecurityPolicy = function (ctx, shop) {
  if (isEmbedded(ctx)) {
    ctx.response.set('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`);
  } else {
    ctx.response.set('Content-Security-Policy', `frame-ancestors 'none';`);
  }
};

/* --- Create JWT to pass data encoded through URL access (Checkout Extension Web Worker) --- */
const createJWT = function (json) {
  return jwt.sign(json, API_SECRET, { algorithm: 'HS256', expiresIn: '3600s' });
};

/* --- Decode JWT passed through URL access (Checkout Extension Web Worker) --- */
// If the given signature in token unmatched, the function produces an expection.
const decodeJWT = function (token) {
  return jwt.verify(token, API_SECRET);
};

/* --- Call Shopify GraphQL --- */
const callGraphql = function (ctx, shop, ql, token = null, path = GRAPHQL_PATH_PAYMENT, vars = null) {
  return new Promise(function (resolve, reject) {
    let api_req = {};
    // Set Gqphql string into query field of the JSON  as string
    api_req.query = ql.replace(/\n/g, '');
    if (vars != null) {
      api_req.variables = vars;
    }
    let access_token = token;
    if (access_token == null) {
      getDB(shop).then(function (shop_data) {
        if (shop_data == null) return reject(null);
        access_token = shop_data.access_token;
        accessEndpoint(ctx, `https://${shop}/${path}`, api_req, access_token).then(function (api_res) {
          return resolve(api_res);
        }).catch(function (e) {
          //console.log(`callGraphql ${e}`);
          return reject(e);
        });
      }).catch(function (e) {
        console.log(`callGraphql ${e}`);
        return reject(e);
      });
    } else {
      accessEndpoint(ctx, `https://${shop}/${path}`, api_req, access_token).then(function (api_res) {
        return resolve(api_res);
      }).catch(function (e) {
        //console.log(`callGraphql ${e}`);
        return reject(e);
      });
    }
  });
};

/* ---  HTTP access common function for GraphQL --- */
const accessEndpoint = function (ctx, endpoint, req, token = null, content_type = CONTENT_TYPE_JSON) {
  console.log(`[ accessEndpoint ] POST ${endpoint} ${JSON.stringify(req)}`);
  return new Promise(function (resolve, reject) {
    // Success callback
    let then_func = function (res) {
      console.log(`[ accessEndpoint ] Success: POST ${endpoint} ${res}`);
      return resolve(JSON.parse(res));
    };
    // Failure callback
    let catch_func = function (e) {
      console.log(`[ accessEndpoint ] Failure: POST ${endpoint} ${e}`);
      return reject(e);
    };
    let headers = {};
    headers['Content-Type'] = content_type;
    if (token != null) {
      headers['X-Shopify-Access-Token'] = token;
      headers['Content-Length'] = Buffer.byteLength(JSON.stringify(req));
      headers['User-Agent'] = 'My_Shopify_Barebone_App';
      headers['Host'] = endpoint.split('/')[2];
    }
    console.log(`[ accessEndpoint ] ${JSON.stringify(headers)}`);
    ctx.post(endpoint, req, headers).then(then_func).catch(catch_func);
  });
};

/* --- Store Shopify data in database --- */
const insertDB = function (key, data) {
  switch (DB_TYPE) {
    case 'POSTGRESQL':
      // PostgreSQL
      return insertDBPostgreSQL(key, data);
    case 'MYSQL':
      // MySQL
      return insertDBMySQL(key, data);
    default:
      // MongoDB
      return insertDBMongo(key, data);
  }
};

/* --- Retrive Shopify data in database --- */
const getDB = function (key) {
  switch (DB_TYPE) {
    case 'POSTGRESQL':
      // PostgreSQL
      return getDBPostgreSQL(key);
    case 'MYSQL':
      // MySQL
      return getDBMySQL(key);
    default:
      // MongoDB
      return getDBMongo(key);
  }
};

/* --- Update Shopify data in database --- */
const setDB = function (key, data) {
  switch (DB_TYPE) {
    case 'POSTGRESQL':
      // PostgreSQL
      return setDBPostgreSQL(key, data);
    case 'MYSQL':
      // MySQL
      return setDBMySQL(key, data);
    default:
      // MongoDB
      return setDBMongo(key, data);
  }
};

/* --- Store Shopify data in database (MongoDB) --- */
const insertDBMongo = function (key, data, collection = MONGO_COLLECTION) {
  return new Promise(function (resolve, reject) {
    mongo.MongoClient.connect(MONGO_URL).then(function (db) {
      //console.log(`insertDB Connected: ${MONGO_URL}`);
      var dbo = db.db(MONGO_DB_NAME);
      console.log(`insertDBMongo Used: ${MONGO_DB_NAME} - ${collection}`);
      console.log(`insertDBMongo insertOne, _id:${key}`);
      dbo.collection(collection).insertOne({ "_id": key, "data": data, "created_at": new Date(), "updated_at": new Date() }).then(function (res) {
        db.close();
        return resolve(0);
      }).catch(function (e) {
        console.log(`insertDBMongo Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`insertDBMongo Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Retrive Shopify data in database (MongoDB) --- */
const getDBMongo = function (key, collection = MONGO_COLLECTION) {
  return new Promise(function (resolve, reject) {
    console.log(`getDBMongo MONGO_URL ${MONGO_URL}`);
    mongo.MongoClient.connect(MONGO_URL).then(function (db) {
      //console.log(`getDB Connected ${MONGO_URL}`);
      var dbo = db.db(MONGO_DB_NAME);
      console.log(`getDBMongo Used ${MONGO_DB_NAME} - ${collection}`);
      console.log(`getDBMongo findOne, _id:${key}`);
      dbo.collection(collection).findOne({ "_id": `${key}` }).then(function (res) {
        db.close();
        if (res == null) return resolve(null);
        return resolve(res.data);
      }).catch(function (e) {
        console.log(`getDBMongo Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`getDBMongo Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Update Shopify data in database (MongoDB) --- */
const setDBMongo = function (key, data, collection = MONGO_COLLECTION) {
  return new Promise(function (resolve, reject) {
    mongo.MongoClient.connect(MONGO_URL).then(function (db) {
      //console.log(`setDB Connected ${MONGO_URL}`);
      var dbo = db.db(MONGO_DB_NAME);
      console.log(`setDBMongo Used ${MONGO_DB_NAME} - ${collection}`);
      console.log(`setDBMongo findOneAndUpdate, _id:${key}`);
      dbo.collection(collection).findOneAndUpdate({ "_id": `${key}` }, { $set: { "data": data, "updated_at": new Date() } }, { new: true }).then(function (res) {
        db.close();
        return resolve(res);
      }).catch(function (e) {
        console.log(`setDBMongo Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`setDBMongo Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Store Shopify data in database (PostgreSQL) --- */
const insertDBPostgreSQL = function (key, data) {
  return new Promise(function (resolve, reject) {
    const client = new Client({
      connectionString: POSTGRESQL_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    client.connect().then(function () {
      //console.log(`insertDBPostgreSQL Connected: ${POSTGRESQL_URL}`);
      const sql = `INSERT INTO ${POSTGRESQL_TABLE} ( _id, data, created_at, updated_at ) VALUES ('${key}', '${JSON.stringify(data).replace(/\\"/g, '\\\\"').replace(/'/g, "\\'")}', '${new Date().toISOString()}',  '${new Date().toISOString()}')`;
      console.log(`insertDBPostgreSQL:  ${sql}`);
      client.query(sql).then(function (res) {
        client.end();
        return resolve(0);
      }).catch(function (e) {
        client.end();
        console.log(`insertDBPostgreSQL Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`insertDBPostgreSQL Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Retrive Shopify data in database (PostgreSQL) --- */
const getDBPostgreSQL = function (key) {
  return new Promise(function (resolve, reject) {
    console.log(`getDBPostgreSQL POSTGRESQL_URL ${POSTGRESQL_URL}`);
    const client = new Client({
      connectionString: POSTGRESQL_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    client.connect().then(function () {
      //console.log(`getDBPostgreSQL Connected: ${POSTGRESQL_URL}`);
      const sql = `SELECT data FROM ${POSTGRESQL_TABLE} WHERE _id = '${key}'`;
      console.log(`getDBPostgreSQL:  ${sql}`);
      client.query(sql).then(function (res) {
        client.end();
        if (res.rows.length == 0) return resolve(null);
        return resolve(res.rows[0].data);
      }).catch(function (e) {
        client.end();
        console.log(`getDBPostgreSQL Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`getDBPostgreSQL Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Update Shopify data in database (PostgreSQL) --- */
const setDBPostgreSQL = function (key, data) {
  return new Promise(function (resolve, reject) {
    const client = new Client({
      connectionString: POSTGRESQL_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    client.connect().then(function () {
      //console.log(`setDBPostgreSQL Connected: ${POSTGRESQL_URL}`);
      const sql = `UPDATE ${POSTGRESQL_TABLE} SET data = '${JSON.stringify(data).replace(/\\"/g, '\\\\"').replace(/'/g, "\\'")}', updated_at = '${new Date().toISOString()}' WHERE _id = '${key}'`;
      console.log(`setDBPostgreSQL:  ${sql}`);
      client.query(sql).then(function (res) {
        client.end();
        return resolve(res.rowCount);
      }).catch(function (e) {
        client.end();
        console.log(`setDBPostgreSQL Error ${e}`);
        return reject(e);
      });
    }).catch(function (e) {
      console.log(`setDBPostgreSQL Error ${e}`);
      return reject(e);
    });
  });
};

/* --- Store Shopify data in database (MySQL) --- */
const insertDBMySQL = function (key, data) {
  return new Promise(function (resolve, reject) {
    const connection = mysql.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE
    });
    connection.connect((e) => {
      if (e) {
        console.log(`insertDBMySQL Error ${e}`);
        return reject(e);
      }
      //console.log(`insertDBMySQL Connected: ${MYSQL_HOST}`);
      const sql = `INSERT INTO ${MYSQL_TABLE} ( _id, data, created_at, updated_at ) VALUES ('${key}', '${JSON.stringify(data).replace(/\\"/g, '\\\\"').replace(/'/g, "\\'")}', '${new Date().toISOString().replace('T', ' ').replace('Z', '')}',  '${new Date().toISOString().replace('T', ' ').replace('Z', '')}')`;
      console.log(`insertDBMySQL:  ${sql}`);
      connection.query(
        sql,
        (e, res) => {
          connection.end();
          if (e) {
            console.log(`insertDBMySQL Error ${e}`);
            return reject(e);
          }
          return resolve(0);
        }
      );
    });
  });
};

/* --- Retrive Shopify data in database (MySQL) --- */
const getDBMySQL = function (key) {
  return new Promise(function (resolve, reject) {
    console.log(`getDBMySQL MYSQL_HOST ${MYSQL_HOST}`);
    const connection = mysql.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE
    });
    connection.connect((e) => {
      //console.log(`getDBMySQL Connected: ${MYSQL_HOST}`);
      if (e) {
        console.log(`getDBMySQL Error ${e}`);
        return reject(e);
      }
      const sql = `SELECT data FROM ${MYSQL_TABLE} WHERE _id = '${key}'`;
      console.log(`getDBMySQL:  ${sql}`);
      connection.query(
        sql,
        (e, res) => {
          connection.end();
          if (e) {
            console.log(`getDBMySQL Error ${e}`);
            return reject(e);
          }
          if (res.length == 0) return resolve(null);
          return resolve(JSON.parse(res[0].data));
        }
      );
    });
  });
};

/* --- Update Shopify data in database (MySQL) --- */
const setDBMySQL = function (key, data) {
  return new Promise(function (resolve, reject) {
    console.log(`setDBMySQL MYSQL_HOST ${MYSQL_HOST}`);
    const connection = mysql.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE
    });
    connection.connect((e) => {
      //console.log(`setDBMySQL Connected: ${MYSQL_HOST}`);
      const sql = `UPDATE ${MYSQL_TABLE} SET data = '${JSON.stringify(data).replace(/\\"/g, '\\\\"').replace(/'/g, "\\'")}', updated_at = '${new Date().toISOString().replace('T', ' ').replace('Z', '')}' WHERE _id = '${key}'`;
      console.log(`setDBMySQL:  ${sql}`);
      if (e) {
        console.log(`setDBMySQL Error ${e}`);
        return reject(e);
      }
      connection.query(
        sql,
        (e, res) => {
          connection.end();
          if (e) {
            console.log(`setDBMySQL Error ${e}`);
            return reject(e);
          }
          return resolve(res.affectedRows);
        }
      );
    });
  });
};

app.use(router.routes());
app.use(router.allowedMethods());

if (!module.parent) app.listen(process.env.PORT || 3000);