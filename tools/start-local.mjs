/** Open the browser only after this project has successfully bound its server. */
import {spawn} from 'node:child_process';
import {createPortfolioServer} from '../server.mjs';
const port=Number(process.env.PORT||3000),host='127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
const server=createPortfolioServer();
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`\nPort ${port} is already in use. Close the older portfolio server terminal first, then run START_WINDOWS.bat again.\nThe browser was NOT opened, to avoid showing the older version.`:error.message);process.exitCode=1;});
server.listen(port,host,()=>{
 const url=`http://${host}:${port}/`;console.log(`\nShehraz Portfolio v6\n${url}\nKeep this terminal open. Press Ctrl+C to stop.\n`);
 if(process.env.NO_OPEN==='1')return;
 const [program,args]=process.platform==='win32'?['cmd.exe',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
 const child=spawn(program,args,{stdio:'ignore',detached:true});child.on('error',()=>console.log('Please open this URL manually: '+url));child.unref();
});
