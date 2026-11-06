import { defineConfig, loadEnv } from 'vite';
import {resolve} from 'node:path';
const pages=['index','menu','product','cooking','checkout','queue','location','qr','admin-login','login','dashboard','orders','kitchen','manage-menu','sales','staff-order'];
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');return {build:{rollupOptions:{input:Object.fromEntries(pages.map(p=>[p,resolve(process.cwd(),p+'.html')]))}},server:{host:'127.0.0.1',proxy:{'/api':`http://127.0.0.1:${env.PORT||process.env.PORT||3001}`}}};});
