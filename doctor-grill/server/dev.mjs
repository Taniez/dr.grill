import {spawn} from 'node:child_process';
const {createServer}=await import('vite');const vite=await createServer();await vite.listen();vite.printUrls();
const server=spawn(process.execPath,['--env-file-if-exists=.env','server/index.mjs'],{stdio:'inherit',env:{...process.env,APP_ORIGIN:vite.resolvedUrls.local[0].replace(/\/$/,'')}});
let closing=false;async function close(code=0){if(closing)return;closing=true;server.kill();await vite.close();process.exit(code);}
process.on('SIGINT',()=>close());process.on('SIGTERM',()=>close());server.on('exit',code=>close(code??1));
