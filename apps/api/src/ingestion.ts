import{createHash}from"node:crypto";import{drawSchema,type DrawInput}from"@atlas/contracts";export interface LotteryResultsProvider{latest(lottery:string):Promise<unknown>;byContest(lottery:string,contest:number):Promise<unknown>;history?(lottery:string,cursor?:string):Promise<unknown>;next?(lottery:string):Promise<unknown>}
export class DisabledCaixaProvider implements LotteryResultsProvider{private fail():never{throw new Error("Fonte automática CAIXA desativada: interface pública documentada não foi confirmada")};async latest(_lottery:string){return this.fail()}async byContest(_lottery:string,_contest:number){return this.fail()}}
const caixaPaths:Record<string,string>={"mega-sena":"megasena",lotofacil:"lotofacil","dia-de-sorte":"diadesorte"};
const months=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
export class CaixaServiceBusProvider implements LotteryResultsProvider{
 private readonly base="https://servicebus2.caixa.gov.br/portaldeloterias/api";
 async latest(lottery:string){return this.fetch(lottery)}
 async byContest(lottery:string,contest:number){if(!Number.isInteger(contest)||contest<1)throw new Error("Concurso inválido");return this.fetch(lottery,contest)}
 normalize(lottery:string,raw:unknown){
  if(typeof raw!=="object"||raw===null)throw new Error("Payload CAIXA inválido");const x=raw as Record<string,unknown>,date=String(x.dataApuracao??"").split("/");
  if(date.length!==3)throw new Error("Data CAIXA inválida");const luckyName=String(x.nomeTimeCoracaoMesSorte??"").trim().toLocaleLowerCase("pt-BR"),numericLuckyMonth=Number(luckyName),luckyMonth=Number.isInteger(numericLuckyMonth)&&numericLuckyMonth>=1&&numericLuckyMonth<=12?numericLuckyMonth:months.indexOf(luckyName)+1;
  return drawSchema.parse({lottery,contestNumber:Number(x.numero),drawDate:`${date[2]}-${date[1]}-${date[0]}`,numbers:Array.isArray(x.listaDezenas)?x.listaDezenas.map(Number):[],originalOrder:Array.isArray(x.dezenasSorteadasOrdemSorteio)?x.dezenasSorteadasOrdemSorteio.map(Number):undefined,luckyMonth:lottery==="dia-de-sorte"?luckyMonth:undefined,sourceUrl:`${this.base}/${caixaPaths[lottery]}/${Number(x.numero)}`,fetchedAt:new Date().toISOString(),parserVersion:"caixa-servicebus-v1"});
 }
 private async fetch(lottery:string,contest?:number){const path=caixaPaths[lottery];if(!path)throw new Error("Modalidade não permitida");const url=`${this.base}/${path}${contest?`/${contest}`:""}`;let error:unknown;
  for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(url,{headers:{"accept":"application/json","user-agent":"AtlasLoto/0.1 (+resultado-oficial; contato-administrador)"},signal:AbortSignal.timeout(10_000)});if(!response.ok)throw new Error(`CAIXA HTTP ${response.status}`);const raw=await response.json();return{raw,input:this.normalize(lottery,raw)}}catch(cause){error=cause;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*2**attempt+Math.random()*100));}}
  throw error;
 }
}
export function normalizeOfficialJson(raw:unknown,sourceUrl:string):DrawInput{if(!sourceUrl.startsWith("https://loterias.caixa.gov.br/"))throw new Error("Origem não permitida");if(typeof raw!=="object"||raw===null)throw new Error("Payload deve ser objeto");const x=raw as Record<string,unknown>;const data={lottery:x.lottery,contestNumber:Number(x.contestNumber),drawDate:x.drawDate,numbers:Array.isArray(x.numbers)?x.numbers.map(Number):x.numbers,luckyMonth:x.luckyMonth==null?null:Number(x.luckyMonth),sourceUrl,fetchedAt:new Date().toISOString(),parserVersion:"official-json-v1"};return drawSchema.parse(data)}
export function payloadHash(raw:unknown){return createHash("sha256").update(JSON.stringify(raw)).digest("hex")}
export function parseAdminJson(text:string,sourceUrl:string){const value=JSON.parse(text);const rows=Array.isArray(value)?value:[value];return rows.map((r,i)=>{try{return{row:i+1,status:"accepted" as const,value:normalizeOfficialJson(r,sourceUrl)}}catch(e){return{row:i+1,status:"rejected" as const,error:e instanceof Error?e.message:String(e)}}})}
