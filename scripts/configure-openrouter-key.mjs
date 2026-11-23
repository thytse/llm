// Private local OpenRouter setup; keeps the HKU configuration intact.
import {readFile,writeFile,chmod} from 'node:fs/promises';
import process from 'node:process';
if(!process.stdin.isTTY){console.error('Run interactively. Do not pass the key in arguments or pipe it.');process.exit(1)}
process.stdout.write('Paste your OpenRouter API key (hidden), then press Enter: ');
process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');let secret='';
process.stdin.on('data',async data=>{for(const ch of data){if(ch==='\u0003'){process.stdin.setRawMode(false);process.stdout.write('\nCancelled.\n');process.exit(1)}if(ch==='\r'||ch==='\n'){process.stdin.setRawMode(false);process.stdin.pause();if(secret.length<16||secret.length>300||/\s/.test(secret)){console.error('\nUnexpected key format. No file was written.');process.exit(1)}let prior='';try{prior=await readFile('.dev.vars','utf8')}catch{}const lines=prior.split(/\r?\n/).filter(l=>!/^OPENROUTER_API_KEY=/.test(l));lines.push('OPENROUTER_API_KEY='+JSON.stringify(secret));await writeFile('.dev.vars',lines.join('\n')+'\n',{mode:0o600});await chmod('.dev.vars',0o600);secret='';process.stdout.write('\nOpenRouter key saved privately; HKU settings preserved. Restart the app to load the key.\n');process.exit(0)}if(ch==='\u007f'||ch==='\b')secret=secret.slice(0,-1);else if(ch>=' ')secret+=ch;}});
