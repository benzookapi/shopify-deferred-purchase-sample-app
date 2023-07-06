import jwt_decode from "jwt-decode";

export function _decodeSessionToken(sessionToken) {
    return jwt_decode(JSON.stringify(sessionToken));
}

export function _getParamValueFromQuery(window, param) {
    return new URLSearchParams(window.location.search).get(param);
}

export function _getShopFromQuery(window) {
    return _getParamValueFromQuery(window, 'shop');
}

export function _getAdminFromShop(shop) {
    return `admin.shopify.com/store/${shop.replace('.myshopify.com', '')}`;
}

