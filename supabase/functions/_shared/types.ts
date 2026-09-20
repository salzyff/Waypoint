export type Country='NG'|'GH'|'KE';
export type Category='cosmetics'|'food'|'textiles'|'agriculture'|'electronics';
export type Role='exporter'|'consultant'|'org_admin'|'platform_admin';
export type Stage='Product'|'Classification'|'Export requirements'|'Rules of origin'|'Transport'|'Destination requirements'|'Customs preparation'|'Ready';
export type Status='ready'|'warning'|'blocked'|'review'|'draft';
export interface Document {id:string;name:string;type:string;country?:string;category?:string;issued?:string;expires?:string;status:'available'|'review';demo:boolean;path?:string;size?:number;}
export interface Product {id:string;name:string;sku:string;description:string;category:Category;ingredients:string;brand:string;classification:string;manufactured:Country;}
export interface Shipment {id:string;name:string;description:string;category:Category;ingredients:string;packaging:string;brand:string;classification:string;confirmed:boolean;manufactured:Country;origin:Country;destination:Country;manufacturer:string;localPercent:number;importer:string;purpose:string;quantity:number;unit:string;weight:number;value:number;currency:string;transport:string;shippingDate:string;documents:Document[];created:string;draft:boolean;}
export type Condition={all:Condition[]}|{any:Condition[]}|{field:string;op:'equals'|'not_equals'|'in'|'gt'|'lt'|'exists'|'missing'|'date_before'|'date_after';value?:unknown};
export interface Rule {id:string;version:string;country:Country|'ALL';direction:'origin'|'destination'|'all';category:Category|'all';stage:Stage;when:Condition;check:Condition;severity:'blocker'|'warning'|'review';title:string;message:string;resolution:string;documentType?:string;sourceId:string;effectiveFrom:string;effectiveUntil?:string;verifiedAt:string;}
export interface Source {id:string;organisation:string;title:string;reference:string;url?:string;jurisdiction:string;checked:string;notes:string;}
export interface RulePack {id:string;name:string;country:Country|'ALL';version:string;previous?:string;published:string;status:'published'|'draft';rules:Rule[];}
export interface Result {rule:Rule;passed:boolean;}
export interface Compilation {id:string;shipmentId:string;sequence:number;at:string;status:Status;results:Result[];mandatory:number;completed:number;blockers:number;warnings:number;reviews:number;packs:{id:string;version:string}[];shipment:Shipment;}
export interface Audit {id:string;at:string;user:string;action:string;entity:string;before?:unknown;after?:unknown;}
export interface Notice {id:string;title:string;read:boolean;at:string;}
export interface Organisation {name:string;country:Country;address:string;contact:string;registration:string;tax:string;}
export interface State {shipments:Shipment[];products:Product[];documents:Document[];compilations:Compilation[];packs:RulePack[];sources:Source[];audit:Audit[];notifications:Notice[];organisation:Organisation;reviews:{shipmentId:string;note:string;decision:string;at:string}[];invitations:{email:string;role:Role}[];}
export const countries:Record<Country,string>={NG:'Nigeria',GH:'Ghana',KE:'Kenya'};
export const flags:Record<Country,string>={NG:'🇳🇬',GH:'🇬🇭',KE:'🇰🇪'};
export const categories:Record<Category,string>={cosmetics:'Packaged cosmetics',food:'Processed food',textiles:'Textiles & apparel',agriculture:'Agricultural products',electronics:'Consumer electronics'};
export const stages:Stage[]=['Product','Classification','Export requirements','Rules of origin','Transport','Destination requirements','Customs preparation','Ready'];
