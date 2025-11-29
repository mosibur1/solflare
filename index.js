import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk, { chalkStderr } from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProgressBar from 'progress';
import ora from 'ora';
import boxen from 'boxen';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  debug: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '🔍  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.blue('DEBUG');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function countdown(seconds, message) {
  return new Promise((resolve) => {
    let remaining = seconds;
    process.stdout.write(`${message} ${remaining}s remaining...`);
    const interval = setInterval(() => {
      remaining--;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`${message} ${remaining}s remaining...`);
      if (remaining <= 0) {
        clearInterval(interval);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        resolve();
      }
    }, 1000);
  });
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

function printProfileInfo(username, checkInStreak, totalPoints, context) {
  printHeader(`Profile Info ${context}`);
  printInfo('Username', username || 'N/A', context);
  printInfo('CheckIn Streak', checkInStreak.toString(), context);
  printInfo('Total Points', totalPoints.toString(), context);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getAxiosConfig(proxy, token = null, additionalHeaders = {}) {
  const headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7,fr;q=0.6,ru;q=0.5,zh-CN;q=0.4,zh;q=0.3',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://kingdom.solflare.com/',
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Opera";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-storage-access': 'active',
    'user-agent': getRandomUserAgent(),
    ...additionalHeaders
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  const config = {
    headers,
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return response;
    } catch (error) {
      if (error.response && error.response.status >= 500 && i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries}) due to server error`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      if (i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

async function readTokens() {
  try {
    const data = await fs.readFile('token.txt', 'utf-8');
    const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`Loaded ${tokens.length} token${tokens.length === 1 ? '' : 's'}`, { emoji: '🔑 ' });
    return tokens;
  } catch (error) {
    logger.error(`Failed to read token.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️ ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐 ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function fetchUserInfo(token, proxy, context) {
  const url = 'https://kingdom.solflare.com/api/v1/users/me';
  const spinner = ora({ text: 'Fetching user info...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      const username = response.data.data.username || 'N/A';
      const checkInStreak = response.data.data.stats.checkInStreak || 0;
      const totalPoints = response.data.data.stats.totalPoints || 0;
      const availableTickets = response.data.data.stats.availableTickets || 0;
      return { username, checkInStreak, totalPoints, availableTickets };
    } else {
      throw new Error('Failed to fetch user info');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch user info: ${error.message}`));
    return { username: 'N/A', checkInStreak: 0, totalPoints: 0, availableTickets: 0 };
  }
}

async function fetchCheckInStatus(token, proxy, context) {
  const url = 'https://kingdom.solflare.com/api/v1/checkin/status';
  const spinner = ora({ text: 'Fetching check-in status...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error('Failed to fetch check-in status');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch check-in status: ${error.message}`));
    return null;
  }
}

async function performCheckIn(token, proxy, context) {
  const url = 'https://kingdom.solflare.com/api/v1/checkin';
  const payload = {};
  const config = getAxiosConfig(proxy, token);
  config.validateStatus = (status) => status >= 200 && status < 500;
  const spinner = ora({ text: 'Performing check-in...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Check-in Successfully./`));
      return { success: true };
    } else {
      spinner.warn(chalk.bold.yellowBright(` Failed to check-in`));
      return { success: false };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to check-in: ${error.message}`));
    return { success: false };
  }
}

async function fetchGames(token, proxy, context) {
  const url = 'https://kingdom.solflare.com/api/v1/games/all';
  const spinner = ora({ text: 'Fetching games...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      const assetDropGame = response.data.data.find(game => game.name === 'Asset Drop');
      if (assetDropGame) {
        return { gameId: assetDropGame.id, ticketCost: assetDropGame.ticketCost, pointsPerAsset: assetDropGame.metadata.pointsPerAsset };
      } else {
        throw new Error('Asset Drop game not found');
      }
    } else {
      throw new Error('Failed to fetch games');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch games: ${error.message}`));
    return null;
  }
}

async function startGame(token, gameId, proxy, context) {
  const url = 'https://kingdom.solflare.com/api/v1/games/start';
  const payload = { gameId };
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Starting game...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Game started`));
      return response.data.data.id;
    } else {
      throw new Error('Failed to start game');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to start game: ${error.message}`));
    return null;
  }
}

async function abandonGame(token, sessionId, proxy, context) {
  const url = `https://kingdom.solflare.com/api/v1/games/sessions/${sessionId}/abandon`;
  const payload = {};
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Abandoning game...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Game abandoned`));
      return true;
    } else {
      throw new Error('Failed to abandon game');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to abandon game: ${error.message}`));
    return false;
  }
}

async function completeGame(token, sessionId, score, duration, assetsClicked, difficulty, proxy, context) {
  const url = `https://kingdom.solflare.com/api/v1/games/complete/${sessionId}`;
  const payload = {
    score,
    gameData: {
      duration,
      assetsClicked,
      difficulty,
      timeRemaining: 0,
      calculatedDuration: 30
    }
  };
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Completing game...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Game Completed Successfully, Points + ${score}`));
      return true;
    } else {
      throw new Error('Failed to complete game');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to complete game: ${error.message}`));
    return false;
  }
}

function calculateAssetsClicked(score, pointsPerAsset) {
  const specialCount = Math.floor(Math.random() * (Math.floor(score / 10) + 1));
  const regularCount = score - (specialCount * pointsPerAsset.special);
  return regularCount + specialCount;
}

async function processAccount(token, index, total, proxy) {
  const context = `Account ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting account processing`), { emoji: '🚀 ', context });

  const { username: initialUsername } = await fetchUserInfo(token, proxy, context);

  printHeader(`Account Info ${context}`);
  printInfo('Username', initialUsername, context);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP', ip, context);
  console.log('\n');

  try {
    logger.info('Starting check-in process...', { emoji: '📋 ', context });
    const checkInStatus = await fetchCheckInStatus(token, proxy, context);
    if (checkInStatus && checkInStatus.canCheckInToday && !checkInStatus.hasCheckedInToday) {
      await performCheckIn(token, proxy, context);
    } else {
      logger.info(chalk.bold.yellowBright('Already Check-in Today!!'), { emoji: '⚠️ ', context });
    }

    logger.info('Starting auto play games...', { emoji: '🎮 ', context });
    let userInfo = await fetchUserInfo(token, proxy, context);
    let availableTickets = userInfo.availableTickets;
    const gamesInfo = await fetchGames(token, proxy, context);
    if (!gamesInfo) {
      logger.warn('Skipping games due to fetch error', { emoji: '⚠️ ', context });
      return;
    }
    const { gameId, ticketCost, pointsPerAsset } = gamesInfo;
    const maxPlays = Math.floor(availableTickets / ticketCost);

    if (maxPlays === 0) {
      logger.info(chalk.bold.yellowBright('No Ticket Available For Play'), { emoji: '⚠️ ', context });
    } else {
      printInfo('Available Ticket', availableTickets, context);
      console.log();
      const bar = new ProgressBar('Processing games [:bar] :percent :etas', {
        complete: '█',
        incomplete: '░',
        width: 30,
        total: maxPlays
      });

      let remainingTickets = availableTickets;
      for (let i = 0; i < maxPlays; i++) {
        printHeader(`Game ${i + 1}/${maxPlays}`);
        printInfo('Remaining Tickets', remainingTickets, context);
        printInfo('Ticket Cost', ticketCost, context);
        console.log();

        const sessionId = await startGame(token, gameId, proxy, context);
        if (!sessionId) continue;

        const playDelay = Math.floor(Math.random() * (55 - 30 + 1)) + 30;
        await countdown(playDelay, 'Playing game ');

        await abandonGame(token, sessionId, proxy, context);

        const score = Math.floor(Math.random() * (900 - 500 + 1)) + 500;
        const difficulty = Math.floor(Math.random() * (700 - 580 + 1)) + 580 + Math.floor(score / 100);
        const assetsClicked = calculateAssetsClicked(score, pointsPerAsset);

        await completeGame(token, sessionId, score, playDelay, assetsClicked, difficulty, proxy, context);

        bar.tick();
        remainingTickets -= ticketCost;
        
        if (i < maxPlays - 1) {
          const nextDelay = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
          console.log();
          await countdown(nextDelay, 'Waiting for Next Game');
        }
        console.log();
      }
      console.log();
      logger.info(`Processed ${maxPlays} games`, { emoji: '📊 ', context });
    }

    const finalUserInfo = await fetchUserInfo(token, proxy, context);
    printProfileInfo(finalUserInfo.username, finalUserInfo.checkInStreak, finalUserInfo.totalPoints, context);

    logger.info(chalk.bold.greenBright(`Completed account processing`), { emoji: '🎉 ', context });
    console.log(chalk.cyanBright('________________________________________________________________________________'));
  } catch (error) {
    logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context });
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = getAxiosConfig(proxy);
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.data.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌ ', context });
    return 'Error retrieving IP';
  }
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want to Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function runCycle() {
  const tokens = await readTokens();
  if (tokens.length === 0) {
    logger.error('No tokens found in token.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < tokens.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processAccount(tokens[i], i, tokens.length, proxy);
    } catch (error) {
      logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context: `Account ${i + 1}/${tokens.length}` });
    }
    if (i < tokens.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NT EXHAUST', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('=== Telegram Channel 🚀 : NT Exhaust (@NTExhaust) ===', terminalWidth)));
  console.log(gradient.retro(centerText('✪ SOLSTICE AUTO CHECKIN & PLAY BOT ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    console.log();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));