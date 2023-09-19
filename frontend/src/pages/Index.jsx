import { useAppBridge } from '@shopify/app-bridge-react';
import { Page, VerticalStack, Card, Layout, Text, Link, Badge, FooterHelp } from '@shopify/polaris';

import { _getAdminFromShop, _getShopFromQuery } from "../utils/my_util";

// Index page for this subscription app setup
function Index() {
    const app = useAppBridge();

    const shop = _getShopFromQuery(window);

    return (
        <>
            <Page title="How to try this deferred purchase options (Pre-order / Try-before-you-buy)">
                <VerticalStack gap="3">
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 1. Create your plans for products</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Link url={`https://${_getAdminFromShop(shop)}/products`} external={true}>Products</Link> and make your <Link url={`https://shopify.dev/docs/apps/selling-strategies/purchase-options/deferred/modeling#plan-setup`} external={true}>selling plans</Link> at <Badge status="info">[Purchase options] &gt; [Create a new option] in each product details</Badge> built as <Link url={`https://github.com/benzookapi/shopify-deferred-purchase-sample-app/blob/main/extensions/my-deferred-purchase-ext/src/index.jsx`} external={true}>Admin UI extension</Link>.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 2. Insert your plan selector into the product detail page</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Badge status="info"><Link url={`https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${SHOPIFY_CONTRACT_EXT_ID}%2Fapp-block&target=newAppsSection`} external={true}>Product detail page editor with this app block</Link></Badge> to enable the plan selector built as <Link url={`https://github.com/benzookapi/shopify-deferred-purchase-sample-app/tree/main/extensions/my-theme-contract-ext`} external={true}>Theme app extension</Link>.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 4. Make your order through the checkout</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Link url={`https://${shop}`} external={true}>your online store</Link> to select the products with selling plans above chosen to checkout. In <Link url={`https://${_getAdminFromShop(shop)}/orders`} external={true}>Orders</Link>, you will see the latest order you made with the <Link url={`https://shopify.dev/docs/api/admin-graphql/unstable/objects/PaymentMandate`} target='_blank'>payment mandates</Link>.
                            </Layout.Section>
                        </Layout>
                    </Card>
                </VerticalStack>
            </Page>
            <FooterHelp>
                &nbsp;
            </FooterHelp>
        </>
    );
}

export default Index