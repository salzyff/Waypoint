import {randomId} from './id';
import type {State,Shipment} from '../types';

/** Empty workspace factory. No fictional organisations, products, rules, or shipments are bundled. */
export function makeShipment(): Shipment {
  return {id:`PSG-${randomId().slice(0,8).toUpperCase()}`,name:'',description:'',category:'cosmetics',ingredients:'',packaging:'',brand:'',classification:'',confirmed:false,manufactured:'NG',origin:'NG',destination:'GH',manufacturer:'',localPercent:0,importer:'',purpose:'Commercial sale',quantity:0,unit:'cartons',weight:0,value:0,currency:'USD',transport:'Air',shippingDate:'',documents:[],created:new Date().toISOString(),draft:true};
}

// Backward-compatible helper for older UI paths. It creates no fixture content.
export function demoDoc(type:string,country?:string){return {id:randomId(),name:'Uploaded evidence',type,country,status:'review' as const,demo:false};}

export function seed(): State {
  return {shipments:[],products:[],documents:[],compilations:[],packs:[],sources:[],audit:[],notifications:[],organisation:{name:'',country:'NG',address:'',contact:'',registration:'',tax:''},reviews:[],invitations:[]};
}
