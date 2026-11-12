// Primeiro import do main.ts: carrega o .env local, se houver, antes de qualquer leitura de ambiente.
// Em produção as variáveis chegam pelo container e o arquivo não existe.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
