// Demo data extracted from actual files
export const DEMO_SKU_MAPPINGS = [
    // Sample mappings from the sales file
    { id: '1', market_sku: 'BNC CHOC TWST RS10', variant_description: 'Classic RT', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '2', market_sku: 'BNC ORNG MST MRP10', variant_description: 'Classic Double Burst', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '3', market_sku: 'MAGICMASALARS10', variant_description: 'Uni Klov Sleeks', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '4', market_sku: 'SFFNTSTKALMONDRS10', variant_description: 'AC L.I.T.', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '5', market_sku: 'SF DF CHO&NUTFL 75', variant_description: 'Classic Clove', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '6', market_sku: 'JELLY 05HNGRASSRTD', variant_description: 'GFK Social Red', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '7', market_sku: 'MAGICMASALA90', variant_description: 'GF Spl Mint', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '8', market_sku: 'AS BESAN 500G', variant_description: 'GFP Blue Mint Switch', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '9', market_sku: 'SF MOM MAGIC CA 05', variant_description: 'Players Mint', created_at: new Date().toISOString(), created_by: 'demo' },
    { id: '10', market_sku: 'SFDFCHOCOFILLS90', variant_description: 'GFK SOCIAL 2POD', created_at: new Date().toISOString(), created_by: 'demo' },
];

export const DEMO_DS_SURVEYORS = [
    { ds_name: 'RUSHIKESH-9321844072-KASHIWALE', surveyor: 'VIVEK (VMC)' },
    { ds_name: 'DHIRAJ PCP-9867213346', surveyor: 'RAJESH JAISWAL (VMC)' },
    { ds_name: 'MANISH - 8779142295   PAYAL -9321848735', surveyor: 'SANDEEP GUPTA (VMC)' },
    { ds_name: 'NITESH - 9146851055 ANIL-MADAN', surveyor: 'SANJAY PATHAK' },
    { ds_name: 'VIRAJ - 9834990365', surveyor: 'ANIL PATHAK' },
    { ds_name: 'RAJNESSH PANDEY-7900032649', surveyor: 'TOWN SWD DS' },
];

export const DEMO_SALES_DATA = [
    { ds_name: 'RUSHIKESH-9321844072-KASHIWALE', market_sku: 'BNC CHOC TWST RS10', invoice_qty: 2.232 },
    { ds_name: 'RUSHIKESH-9321844072-KASHIWALE', market_sku: 'BNC ORNG MST MRP10', invoice_qty: 2.088 },
    { ds_name: 'RUSHIKESH-9321844072-KASHIWALE', market_sku: 'MAGICMASALARS10', invoice_qty: 0.6 },
    { ds_name: 'RUSHIKESH-9321844072-KASHIWALE', market_sku: 'SFFNTSTKALMONDRS10', invoice_qty: 0.27 },
    { ds_name: 'DHIRAJ PCP-9867213346', market_sku: 'MD603IN1', invoice_qty: 0.092 },
    { ds_name: 'DHIRAJ PCP-9867213346', market_sku: 'MD60FUSIONS', invoice_qty: 0.182 },
    { ds_name: 'DHIRAJ PCP-9867213346', market_sku: 'MD60SCENT3IN1', invoice_qty: 0.091 },
    { ds_name: 'MANISH - 8779142295   PAYAL -9321848735', market_sku: 'ENGMANPKTMV18', invoice_qty: 1.02 },
    { ds_name: 'NITESH - 9146851055 ANIL-MADAN', market_sku: 'ENGMANPKTMV18', invoice_qty: 0.102 },
    { ds_name: 'RAJNESSH PANDEY-7900032649', market_sku: 'BNC BOURBONCH05', invoice_qty: 0.624 },
];

export const DEMO_TEMPLATE_DATA = {
    surveyors: ['VIVEK (VMC)', 'RAJESH JAISWAL (VMC)', 'SANDEEP GUPTA (VMC)', 'SANJAY PATHAK', 'ANIL PATHAK', 'TOWN SWD DS', 'VED PRAKASH', 'ZAHEER'],
    variants: ['Classic RT', 'Classic Double Burst', 'Uni Klov Sleeks', 'AC L.I.T.', 'Classic Clove', 'GFK Social Red', 'GF Spl Mint', 'GFP Blue Mint Switch', 'Players Mint', 'GFK SOCIAL 2POD'],
};
