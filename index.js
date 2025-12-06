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
    if (response && response.data && response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Game started`));
      return response.data.data;
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max, decimals = 2) {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}
function pickWeighted(weights) {
  const total = weights.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const it of weights) {
    r -= it.w;
    if (r <= 0) return it.v;
  }
  return weights[weights.length - 1].v;
}

function mapDifficultyFromMeta(metaDifficultyLabel, score) {
  let baseMin = 450;
  let baseMax = 520;
  if (!metaDifficultyLabel) metaDifficultyLabel = 'medium';
  const label = String(metaDifficultyLabel).toLowerCase();
  if (label.includes('easy')) {
    baseMin = 320; baseMax = 460;
  } else if (label.includes('medium')) {
    baseMin = 460; baseMax = 620;
  } else if (label.includes('hard')) {
    baseMin = 600; baseMax = 820;
  } else {
    baseMin = 440; baseMax = 640;
  }

  const scoreFactor = Math.floor(score / 20);
  const base = randInt(baseMin, baseMax);
  const difficulty = Math.max(100, Math.min(1000, base + scoreFactor + randInt(-20, 20)));
  return difficulty;
}


function generateGameData({
  score,
  playTimeSec,
  duration,
  pointsPerAsset = { regular: 1, special: 10, powerup: 0 },
  calculatedDuration = 30,
  difficultyMetaLabel = null,
  completionToken = null,
  totalAssetsSpawnedOverride = null
}) {
  const playTime = (typeof playTimeSec === 'number' && !Number.isNaN(playTimeSec))
    ? playTimeSec
    : ((typeof duration === 'number' && !Number.isNaN(duration)) ? duration : randInt(40, 60));

  const powerupsClicked = randInt(6, 13);

  const freezePerPowerupMin = 0.9;
  const freezePerPowerupMax = 2.2;
  let freezeTime = 0;
  for (let i = 0; i < powerupsClicked; i++) {
    freezeTime += randFloat(freezePerPowerupMin, freezePerPowerupMax, 3);
  }
  freezeTime = Number(freezeTime.toFixed(3));

  const rawDuration = playTime + freezeTime;
  const clientReportedDuration = Number((rawDuration + randFloat(-1.2, 1.2)).toFixed(2));
  const durationVal = Number(Math.max(0.5, clientReportedDuration).toFixed(2));

  const bombsClicked = randInt(0, Math.min(3, Math.floor(Math.random() * 3)));

  const specialPoint = Math.max(1, pointsPerAsset.special || 10);
  const estSpecial = Math.min(randInt(0, Math.floor(score / specialPoint) + 1), Math.max(0, Math.floor(score / specialPoint)));
  const specialAssetsClicked = estSpecial;

  const regularValue = Math.max(1, pointsPerAsset.regular || 1);
  const remPoints = Math.max(0, score - (specialAssetsClicked * specialPoint));
  const regularAssetsClicked = Math.max(0, Math.round(remPoints / regularValue));

  let assetsClicked = Math.max(0, randInt(Math.floor(regularAssetsClicked / 2), regularAssetsClicked + specialAssetsClicked));
  if (Math.random() < 0.6) assetsClicked += powerupsClicked;
  if (bombsClicked > 0 && Math.random() < 0.5) assetsClicked += bombsClicked;

  const safeCalculatedDuration = (typeof calculatedDuration === 'number' && calculatedDuration > 0) ? calculatedDuration : 30;
  const baseSpawn = Math.max(120, Math.floor((playTime / safeCalculatedDuration) * 200) + Math.floor(score * 1.2));
  const totalAssetsSpawned = totalAssetsSpawnedOverride || randInt(baseSpawn, baseSpawn + 220);

  const diff = mapDifficultyFromMeta(difficultyMetaLabel, score);

  const timeRemaining = 0;
  const completionTok = completionToken || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    score,
    gameData: {
      duration: Number.isFinite(durationVal) ? durationVal : 0.0,
      clientReportedDuration: Number.isFinite(durationVal) ? durationVal : 0.0,
      assetsClicked: Number.isFinite(assetsClicked) ? assetsClicked : 0,
      regularAssetsClicked: Number.isFinite(regularAssetsClicked) ? regularAssetsClicked : 0,
      specialAssetsClicked: Number.isFinite(specialAssetsClicked) ? specialAssetsClicked : 0,
      bombsClicked: Number.isFinite(bombsClicked) ? bombsClicked : 0,
      powerupsClicked: Number.isFinite(powerupsClicked) ? powerupsClicked : 0,
      totalAssetsSpawned: Number.isFinite(totalAssetsSpawned) ? totalAssetsSpawned : 0,
      freezeTimeUsed: Number.isFinite(freezeTime) ? freezeTime : 0.0,
      difficulty: Number.isFinite(diff) ? diff : 0,
      timeRemaining,
      calculatedDuration: safeCalculatedDuration,
      completionToken: completionTok
    }
  };
}

async function completeGame(token, sessionObj, score, playTimeSec, difficulty, pointsPerAsset, proxy, context) {
  if (!sessionObj || !sessionObj.id) {
    logger.error('Invalid session object passed to completeGame', { context });
    return { ok: false, reason: 'invalid_session' };
  }
  const sessionId = sessionObj.id;
  const serverCompletionToken = sessionObj.gameData && sessionObj.gameData.completionToken ? sessionObj.gameData.completionToken : null;

  const calculatedDuration = (sessionObj.game && sessionObj.game.metadata && sessionObj.game.metadata.gameDuration) ? sessionObj.game.metadata.gameDuration : 30;
  const difficultyLabel = (sessionObj.game && sessionObj.game.metadata && sessionObj.game.metadata.difficulty) ? sessionObj.game.metadata.difficulty : null;

  const payload = generateGameData({
    score,
    playTimeSec,
    pointsPerAsset: pointsPerAsset || { regular: 1, special: 10, powerup: 0 },
    calculatedDuration,
    difficultyMetaLabel: difficultyLabel,
    completionToken: serverCompletionToken
  });

  const url = `https://kingdom.solflare.com/api/v1/games/complete/${sessionId}`;
  const config = getAxiosConfig(proxy, token);
  config.validateStatus = (status) => status >= 200 && status < 500;
  const spinner = ora({ text: 'Completing game...', spinner: 'dots' }).start();

  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);

    if (response && response.data && response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Game Completed Successfully, Points + ${score}`));
      return { ok: true, payload, response: response.data };
    } else {
      spinner.fail(chalk.bold.yellowBright(` Server rejected completion`));
      logger.warn('CompleteGame rejected by server', { context });
      return { ok: false, payload, response: response ? response.data : null };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to complete game: ${error.message}`));
    return { ok: false, payload, error: error.message };
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

                const session = await startGame(token, gameId, proxy, context);
        if (!session) continue;

        const playTime = Math.floor(Math.random() * (60 - 40 + 1)) + 40;
        await countdown(playTime, 'Playing game ');
        const abandoned = await abandonGame(token, session.id, proxy, context);
        if (!abandoned) {
          logger.warn('Abandon failed; skipping complete', { context });
          continue;
        }

        const score = Math.floor(Math.random() * (900 - 500 + 1)) + 500;

        const difficultyLabel = (session.game && session.game.metadata && session.game.metadata.difficulty) ? session.game.metadata.difficulty : 'medium';
        const difficulty = mapDifficultyFromMeta(difficultyLabel, score);

        const result = await completeGame(token, session, score, playTime, difficulty, pointsPerAsset, proxy, context);


        if (!result.ok) {
          logger.warn('Complete game failed or rejected by server', { context, emoji: '⚠️' });
        } 

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
