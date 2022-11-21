'use strict';
//NOTE: NEED TO BE SET FOR CORRECT CONDITIONS!!!
const mainnetChainId = 1;

const tokenSymbol = 'PRBLY';
const tokenDecimals = 18;
const tokenImage = 'https://gateway.pinata.cloud/ipfs/QmVubnsu7kPZ6jYcZ37WuNGxDc1KUxqGxZaK8ViuTTMMFk';

function ropstenAbiURL(addr) {
    return `https://api-ropsten.etherscan.io/api?module=contract&action=getabi&address=${addr}&apikey=DX7KTQFRWXR6PHJEYMP5CZWAT5WQHGIH52`;
}
function mainnetAbiURL(addr) {
    return `https://api.etherscan.io/api?module=contract&action=getabi&address=${addr}&apikey=DX7KTQFRWXR6PHJEYMP5CZWAT5WQHGIH52`;
}

// PRBLY
const ROPSTEN_PRBLY_ADDR = '0x55E265CF88cfa26e84f3d20291288F06b680bFca';
const MAINNET_PRBLY_ADDR = '0x6361F338Ab8DEf2AF3f2A1Be7BD8A7dB3156F7E7';

// staking addr
const ROPSTEN_STAKING_ADDR = '0x4f2324ec964236A9B12F89Fc9Fd9aAd269C8AA5A';
const MAINNET_STAKING_ADDR = '0x3808b6e0f081bAa9383654a45D092E3b4bFE3394';

// ABI
const ROPSTEN_STAKING_ABI_URL =
    'https://gist.githubusercontent.com/0xEwok/bcdd64b7aa82d2a989a3761a66e0bc65/raw/912781f96202bde4b76120406411d196aceeb109/ropsten.json';
const MAINNET_PRBLY_ABI_URL = 'https://probably0.mypinata.cloud/ipfs/QmWGMc86tRBC8t2dQ2ZU6o2yX2TcdJPdcp737MhFdLmpYr';

const USE = 'mainnet';

// PRBLY
const prblyAddress = USE === 'mainnet' ? MAINNET_PRBLY_ADDR : ROPSTEN_PRBLY_ADDR;
const prblyAbiURL = USE === 'mainnet' ? MAINNET_PRBLY_ABI_URL : ropstenAbiURL(ROPSTEN_PRBLY_ADDR);
// staking
const stakingContractAddress = USE === 'mainnet' ? MAINNET_STAKING_ADDR : ROPSTEN_STAKING_ADDR;
const stakingAbiURL = USE === 'mainnet' ? mainnetAbiURL(MAINNET_STAKING_ADDR) : ROPSTEN_STAKING_ABI_URL;

const blockExplorerBaseURL = `https://${USE === 'ropsten' ? 'ropsten.' : ''}etherscan.io/tx/`;

const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;

let web3, chainId, chainData, accounts, provider;
let ethersProvider;
let web3Modal;
let prblyAbi;
let stakingAbi;
let prblyContract, stakingContract;
let selectedAccount;
let ensAddress, displayAddress;
let txHash;
let connected;

let prblyBalance;
let sprblyBalance;
let sprblyBalanceToPrbly;
let approvedAmountPrblyStakingContract;

let inputPRBLY = 0;
let inputSPRBLY = 0;
let ratioSPRBLYtoPRBLY = 1;

let rewardsPerEpoch, rewardsPeriodEndTime, rewardsEpochLength, stakingPoolSize;

async function onAddToken() {
    console.log('onAddToken');
    try {
        await ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: stakingContractAddress,
                    symbol: 'sPRBLY',
                    decimals: tokenDecimals,
                    image: tokenImage,
                },
            },
        });
    } catch (error) {
        console.log('onAddToken error: ' + error);
    }
}

const HTML_TEXT_FIELD_STAKE = document.getElementById('text-field-stake-amount');
const HTML_TEXT_FIELD_UNSTAKE = document.getElementById('text-field-unstake-amount');

const HTML_DISPLAY_PRBLY_BALANCE = document.getElementById('display-value-prbly-balance');
const HTML_DISPLAY_SPRBLY_BALANCE = document.getElementById('display-value-sprbly-balance');
const HTML_DISPLAY_VALUE = document.getElementById('display-value-total');
const HTML_DISPLAY_SPRBLY_CONVERT_PRBLY = document.getElementById('display-sprbly-convert-prbly');

const HTML_DIV_BUTTON_STAKE = document.getElementById('div-button-stake');
const HTML_DIV_BUTTON_STAKE_APPROVE = document.getElementById('div-button-stake-approve');
const HTML_DIV_BUTTON_STAKE_CONNECT = document.getElementById('div-button-stake-connect');
const HTML_DIV_BUTTON_UNSTAKE = document.getElementById('div-button-unstake');
const HTML_DIV_BUTTON_UNSTAKE_CONNECT = document.getElementById('div-button-unstake-connect');
const HTML_BUTTON_STAKE = document.getElementById('button-stake');
const HTML_BUTTON_STAKE_APPROVE = document.getElementById('button-stake-approve');
const HTML_BUTTON_STAKE_CONNECT = document.getElementById('button-stake-connect');
const HTML_BUTTON_UNSTAKE = document.getElementById('button-unstake');
const HTML_BUTTON_UNSTAKE_CONNECT = document.getElementById('button-unstake-connect');

const HTML_P_STAKE_RECEIPT = document.getElementById('receipt-stake-link');
const HTML_P_STAKE_RECEIPT_MSG = document.getElementById('receipt-stake-text');
const HTML_P_STAKE_RECEIPT_MSG2 = document.getElementById('receipt-stake-text2');
const HTML_P_UNSTAKE_RECEIPT = document.getElementById('receipt-unstake-link');
const HTML_P_UNSTAKE_RECEIPT_MSG = document.getElementById('receipt-unstake-text');
const HTML_P_UNSTAKE_RECEIPT_MSG2 = document.getElementById('receipt-unstake-text2');

const HTML_IMG_STAKE = document.getElementById('receipt-stake-img');
const HTML_IMG_UNSTAKE = document.getElementById('receipt-unstake-img');

const HTML_DIV_STAKE_PREVIEW = document.getElementById('preview-stake');
const HTML_DIV_UNSTAKE_PREVIEW = document.getElementById('preview-unstake');

const code = 'NTgzNWIwYjA2MzI1NDg5M2FjNDk2YWMxMmJmYzg5Njk=';
const providerOptions = {
    walletconnect: {
        package: WalletConnectProvider,
        options: {
            infuraId: atob(code),
        },
    },
};

function nfmt(number, decimals, dec_point, thousands_sep) {
    // http://kevin.vanzonneveld.net
    var n = !isFinite(+number) ? 0 : +number,
        prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
        sep = typeof thousands_sep === 'undefined' ? ',' : thousands_sep,
        dec = typeof dec_point === 'undefined' ? '.' : dec_point,
        toFixedFix = function (n, prec) {
            // Fix for IE parseFloat(0.55).toFixed(0) = 0;
            var k = Math.pow(10, prec);
            return Math.round(n * k) / k;
        },
        s = (prec ? toFixedFix(n, prec) : Math.round(n)).toString().split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
}

function float18(s) {
    return parseFloat(ethers.utils.formatUnits(s.toString(), 18));
}

function init() {
    console.log('init');
    if (location.protocol !== 'https:') {
        console.log("Connect using HTTPS! Web3 won't work without it.");
        return;
    }

    resetWeb3Modal();
}

function resetWeb3Modal() {
    console.log('resetWeb3Modal');
    web3Modal = new Web3Modal({
        cacheProvider: false,
        providerOptions,
        disableInjectedProvider: false,
    });
}

async function fetchAccountData(provider, attempt = 1) {
    console.log(`fetchAccountData(attempt=${attempt})`);
    try {
        accounts = await web3.eth.getAccounts();
        selectedAccount = accounts[0];
        console.log(`selectedAccount`, selectedAccount);
        ensAddress = await ethersProvider.lookupAddress(selectedAccount);
        console.log(`ensAddress`, ensAddress);
        displayAddress =
            ensAddress === null ? selectedAccount.slice(0, 6) + '...' + selectedAccount.slice(38, 42) : ensAddress;
        console.log(`displayAddress`, displayAddress);
        const rowResolvers = accounts.map(async (address) => {
            const balance = await web3.eth.getBalance(address);
            const ethBalance = web3.utils.fromWei(balance, 'ether');
        });

        await Promise.all(rowResolvers);

        await getVarsFromContracts();
    } catch (e) {
        console.error(e);
        if (attempt < 3) {
            await fetchAccountData(provider, attempt + 1);
        } else {
            console.error('FAILURE!');
        }
    }

    showConnectedState();
}

function showDisconnectedState() {
    console.log('showDisconnectedState');
    connected = false;
    document.querySelector('#prepare').style.display = 'block';
    document.querySelector('#connected').style.display = 'none';
    HTML_DIV_BUTTON_STAKE_CONNECT.style.display = 'block';
    HTML_DIV_BUTTON_STAKE.style.display = 'none';
    HTML_DIV_BUTTON_UNSTAKE_CONNECT.style.display = 'block';
    //document.querySelector("#swapDisabledMessage").style.display = "none";
    HTML_DIV_BUTTON_STAKE_APPROVE.style.display = 'none';
    document.querySelector('#addressText').innerHTML = '';
}

function showConnectedState() {
    console.log('showConnectedState');
    connected = true;
    updateConversionBalance();
    document.querySelector('#prepare').style.display = 'none';
    document.querySelector('#connected').style.display = 'flex';
    document.querySelector('#connected').classList.add('div-block-16');
    document.querySelector('#connected').classList.add('w-clearfix');
    HTML_DIV_BUTTON_STAKE_CONNECT.style.display = 'none';
    HTML_DIV_BUTTON_UNSTAKE_CONNECT.style.display = 'none';
    document.querySelector('#addressText').innerHTML = displayAddress;
    showHideButtons();
}

function showSwitchNetwork(show) {
    console.log('showSwitchNetwork: ' + show.toString() + ' chainId: ' + chainId);
    document.querySelector('#switchNetwork').style.display = show ? 'block' : 'none';
    HTML_BUTTON_STAKE.disabled = show;
    HTML_BUTTON_UNSTAKE.disabled = show;
}

function showHideButtons() {
    showUnstakeButton();
    showStakeOrApproveButtons();
}

function showUnstakeButton() {
    HTML_DIV_BUTTON_UNSTAKE.style.display = 'block';
    if (float18(inputSPRBLY) <= 0) {
        HTML_BUTTON_UNSTAKE.style.color = 'darkgrey';
        HTML_BUTTON_UNSTAKE.style.backgroundColor = 'grey';
    } else {
        HTML_BUTTON_UNSTAKE.style.color = 'white';
        HTML_BUTTON_UNSTAKE.style.backgroundColor = '#eaa019';
    }
}

function showStakeOrApproveButtons() {
    const needsApproval =
        approvedAmountPrblyStakingContract === undefined ||
        approvedAmountPrblyStakingContract === 0 ||
        approvedAmountPrblyStakingContract === '0';
    HTML_DIV_BUTTON_STAKE_APPROVE.style.display = needsApproval && !submittedApproval ? 'block' : 'none';
    HTML_DIV_BUTTON_STAKE.style.display = needsApproval ? 'none' : 'block';
    if (float18(inputPRBLY) <= 0) {
        HTML_BUTTON_STAKE.style.color = 'darkgrey';
        HTML_BUTTON_STAKE.style.backgroundColor = 'grey';
    } else {
        HTML_BUTTON_STAKE.style.color = 'white';
        HTML_BUTTON_STAKE.style.backgroundColor = '#eaa019';
    }
}

async function getVarsFromContracts(attempt = 1) {
    console.log(`getVarsFromContract(attempt=${attempt})`);
    try {
        console.log('Retrieve PRBLY balance...');
        // PRBLY balance
        await prblyContract.methods
            .balanceOf(selectedAccount)
            .call({ from: selectedAccount })
            .then((result) => {
                prblyBalance = result;
                console.log(`prblyBalance: ${result}`);
                HTML_DISPLAY_PRBLY_BALANCE.innerText = nfmt(float18(prblyBalance), 2);
            });

        // PRBLY approval amount
        console.log('Retrieve PRBLY approval amount...');
        await prblyContract.methods
            .allowance(selectedAccount, stakingContractAddress)
            .call({ from: selectedAccount })
            .then((result) => {
                approvedAmountPrblyStakingContract = result;
                console.log(`approvedAmountPrblyStakingContract: ${result}`);
            });

        // sPRBLY balance
        console.log('Retrieve sPRBLY balance...');
        await stakingContract.methods
            .balanceOf(selectedAccount)
            .call({ from: selectedAccount })
            .then((result) => {
                sprblyBalance = result;
                console.log(`sprblyBalance: ${result}`);
                HTML_DISPLAY_SPRBLY_BALANCE.innerText = nfmt(float18(sprblyBalance), 2);
            });

        // toPRBLY(sPRBLY)
        console.log('Retrieve sPRBLY/PRBLY ratio...');
        await stakingContract.methods
            .toBaseToken(sprblyBalance)
            .call({ from: selectedAccount })
            .then((result) => {
                sprblyBalanceToPrbly = result;
                console.log(`sprblyBalanceToPrbly: ${result}`);

                const sprblyBalanceToPrblyFloat = float18(sprblyBalanceToPrbly);
                const prblyBalanceFloat = float18(prblyBalance);
                const sprblyBalanceFloat = float18(sprblyBalance);
                HTML_DISPLAY_SPRBLY_CONVERT_PRBLY.value = nfmt(sprblyBalanceToPrblyFloat, 2);
                HTML_DISPLAY_VALUE.innerText = nfmt(prblyBalanceFloat + sprblyBalanceToPrblyFloat, 2);
                ratioSPRBLYtoPRBLY = sprblyBalanceFloat / sprblyBalanceToPrblyFloat;
                console.log('ratio', ratioSPRBLYtoPRBLY);
                updateConversionBalance();
            });

        console.log('Retrieve rewardsPerEpoch...');
        rewardsPerEpoch = float18(await stakingContract.methods.getRewardsPerEpoch().call({ from: selectedAccount }));
        console.log('rewardsPerEpoch', rewardsPerEpoch);

        console.log('Retrieve rewardsPeriodEndTime...');
        rewardsPeriodEndTime = await stakingContract.methods.getRewardsPeriodEndTime().call({ from: selectedAccount });
        console.log('rewardsPeriodEndTime', rewardsPeriodEndTime);

        console.log('Retrieve rewardsEpochLength...');
        rewardsEpochLength = await stakingContract.methods.getRewardsEpochLength().call({ from: selectedAccount });
        console.log('rewardsEpochLength', rewardsEpochLength);

        console.log('Retrieve stakingPoolSize...');
        stakingPoolSize = float18(await stakingContract.methods.getStakingPoolSize().call({ from: selectedAccount }));
        console.log('stakingPoolSize', stakingPoolSize);

        const dailyEpochs = 86400 / rewardsEpochLength;
        const yearlyEpochs = (365 * 86400) / rewardsEpochLength;
        const dailyRewards = dailyEpochs * rewardsPerEpoch;
        const yearlyRewards = rewardsPerEpoch * dailyEpochs * 365;
        console.log('dailyEpochs', dailyEpochs);
        console.log('yearlyEpochs', yearlyEpochs);
        console.log('dailyRewards', dailyRewards);
        console.log('yearlyRewards', yearlyRewards);

        const apy = (100 * yearlyRewards) / stakingPoolSize;
        console.log('apy', apy);

        if (Date.now() / 1000 < rewardsPeriodEndTime) {
            if (apy >= 1) {
                document.getElementById('headline').innerText = `Stake PRBLY, earn up to ${nfmt(apy, 0)}% in rewards`;
            }
        } else {
            document.getElementById('subheadline').innerText =
                'New rewards are currently paused, but should be re-filled soon. Check with Probably Nothing team in discord.';
        }
    } catch (error) {
        console.error(error);
        if (attempt < 3) {
            await getVarsFromContracts(attempt + 1);
        } else {
            console.error('FAILURE!');
        }
    }
}

async function onConnect(showModal) {
    console.log('onConnect');
    try {
        provider = await web3Modal.connect();
        ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        web3 = new Web3(provider);
        chainId = await web3.eth.getChainId();
        console.log(`chain id: ${chainId}`);
        chainData = evmChains.getChain(chainId);

        prblyContract = new web3.eth.Contract(prblyAbi, prblyAddress);
        stakingContract = new web3.eth.Contract(stakingAbi, stakingContractAddress);
    } catch (e) {
        console.error('Something went wrong during connection:\n ', e);
        return;
    }

    provider.on('accountsChanged', async (accounts) => {
        console.log('accountChanged');
        await fetchAccountData(provider);
        getVarsFromContracts();
    });

    provider.on('chainChanged', async (chainId) => {
        console.log('chainChanged-callback');
        chainId = await web3.eth.getChainId();
        chainData = evmChains.getChain(chainId);
        await fetchAccountData(provider);
        showSwitchNetwork(chainId !== mainnetChainId);
    });

    provider.on('error', async (error) => {
        console.error('error');
        resetWeb3Modal();
        await fetchAccountData(provider);
        console.error(error);
    });
    showSwitchNetwork(chainId !== mainnetChainId);
    await fetchAccountData(provider);
}

async function onDisconnect() {
    console.log('onDisconnect');
    if (provider && provider.disconnect) {
        await provider.disconnect();
        await web3Modal.clearCachedProvider();
        provider = null;
    }
    resetWeb3Modal();

    selectedAccount = null;

    showDisconnectedState();
}

async function onSwitchNetwork() {
    console.log('onSwitchNetwork');
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: Web3.utils.toHex(mainnetChainId) }],
    });
}

function updateConversionBalance() {
    const sprblyReceived = getExpectedReceiveSPRBLY();
    if (connected && sprblyReceived >= 0) {
        HTML_DIV_STAKE_PREVIEW.innerText = nfmt(sprblyReceived, 4);
    } else {
        HTML_DIV_STAKE_PREVIEW.innerText = '----';
    }

    HTML_DIV_UNSTAKE_PREVIEW.innerText = nfmt(getExpectedReceivePRBLY(), 4);
    const prblyReceived = getExpectedReceivePRBLY();
    if (connected && prblyReceived >= 0) {
        HTML_DIV_UNSTAKE_PREVIEW.innerText = nfmt(prblyReceived, 4);
    } else {
        HTML_DIV_UNSTAKE_PREVIEW.innerText = '----';
    }
}

function onChangeStakeBalance() {
    console.log('onChangeStakeBalance');
    let prblyDeposit = HTML_TEXT_FIELD_STAKE.value;
    prblyDeposit = prblyDeposit !== '' ? prblyDeposit : '0';

    if (!isNaN(parseFloat(prblyDeposit)) && isFinite(prblyDeposit)) {
        inputPRBLY = ethers.utils.parseUnits(prblyDeposit, 18);
    } else {
        inputPRBLY = ethers.utils.parseUnits('0', 18);
    }
    console.log('inputStakeAmount', inputPRBLY);
    updateConversionBalance();

    if (!connected) {
        return;
    }
    showStakeOrApproveButtons();
}

function onChangeUnstakeBalance() {
    console.log('onChangeUnstakeBalance');
    let sprblyDeposit = HTML_TEXT_FIELD_UNSTAKE.value;
    sprblyDeposit = sprblyDeposit !== '' ? sprblyDeposit : '0';

    if (!isNaN(parseFloat(sprblyDeposit)) && isFinite(sprblyDeposit)) {
        inputSPRBLY = ethers.utils.parseUnits(sprblyDeposit, 18);
    } else {
        inputSPRBLY = ethers.utils.parseUnits('0', 18);
    }
    console.log('inputUnstakeAmount', inputSPRBLY);
    updateConversionBalance();

    if (!connected) {
        return;
    }
    showUnstakeButton();
}

async function onStakeMaxButton() {
    console.log('onStakeMaxButton');
    HTML_TEXT_FIELD_STAKE.value =
        prblyBalance === undefined ? 0 : ethers.utils.formatUnits(prblyBalance.toString(), 18);
    onChangeStakeBalance();
}

async function onUnstakeMaxButton() {
    console.log('onUnstakeMaxButton');
    HTML_TEXT_FIELD_UNSTAKE.value =
        sprblyBalance === undefined ? 0 : ethers.utils.formatUnits(sprblyBalance.toString(), 18);
    onChangeUnstakeBalance();
}

const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
let submittedApproval = false;

async function onApproveTokens() {
    console.log('onApproveTokens');
    if (submittedApproval) {
        console.log('Already submitted approval!');
        return;
    }

    console.log('approve', MAX_INT);
    const gasPrice = await web3.eth.getGasPrice();
    console.log('gas price', web3.utils.fromWei(gasPrice, 'Gwei'));
    prblyContract.methods
        .approve(stakingContractAddress, MAX_INT)
        .send({
            from: selectedAccount,
            maxPriorityFeePerGas: null,
            maxFeePerGas: null,
        })
        .on('transactionHash', (hash) => {
            txHash = hash;
            console.log('Hash', hash);
            submittedApproval = true;
            HTML_TEXT_FIELD_STAKE.value = '';
            HTML_P_STAKE_RECEIPT_MSG.innerText = 'Step (1/2): Approval submitted for staking contract to spend PRBLY';
            HTML_P_STAKE_RECEIPT_MSG2.innerText = 'Please wait for your transaction to confirm';
            HTML_P_STAKE_RECEIPT.innerHTML = `Approve Tx: <a  target="_blank" href="${blockExplorerBaseURL}${txHash}">${txHash}</a>`;
            HTML_P_STAKE_RECEIPT.style.display = 'block';
            HTML_P_STAKE_RECEIPT_MSG.style.display = 'block';
            HTML_P_STAKE_RECEIPT_MSG2.style.display = 'block';
            HTML_BUTTON_STAKE_APPROVE.disabled = true;
            HTML_BUTTON_STAKE_APPROVE.onclick = null;
            HTML_BUTTON_STAKE_APPROVE.style.color = 'darkgrey';
            HTML_BUTTON_STAKE_APPROVE.style.backgroundColor = 'grey';
            HTML_IMG_STAKE.style.display = 'block';
            showStakeOrApproveButtons();
        })
        .on('receipt', async (receipt) => {
            console.log('Receipt', receipt);
            HTML_P_STAKE_RECEIPT_MSG.innerText = 'Approval transaction confirmed. You may now stake your PRBLY.';
            HTML_P_STAKE_RECEIPT_MSG2.style.display = 'none';
            HTML_IMG_STAKE.style.display = 'none';
            showStakeOrApproveButtons();
            await fetchAccountData(provider);
        })
        .on('error', async (error, receipt) => {
            console.error('receipt', receipt);
            console.error(error);
            await fetchAccountData(provider);
        });
}

function getExpectedReceivePRBLY() {
    const inputSPRBLYFloat = float18(inputSPRBLY);
    let expectedReceivePRBLY;
    if (ratioSPRBLYtoPRBLY > 0) {
        expectedReceivePRBLY = inputSPRBLYFloat / ratioSPRBLYtoPRBLY;
    } else {
        expectedReceivePRBLY = inputSPRBLYFloat;
    }
    return expectedReceivePRBLY;
}

function getExpectedReceiveSPRBLY() {
    const inputPRBLYFloat = float18(inputPRBLY);
    let expectedReceiveSPRBLY;
    if (ratioSPRBLYtoPRBLY > 0) {
        expectedReceiveSPRBLY = inputPRBLYFloat * ratioSPRBLYtoPRBLY;
    } else {
        expectedReceiveSPRBLY = inputPRBLYFloat;
    }
    return expectedReceiveSPRBLY;
}

async function onStake() {
    console.log('onStake');

    if (inputPRBLY === 0 || inputPRBLY.isZero()) {
        console.error('input stake amount is', inputPRBLY);
    } else if (inputPRBLY.gt(prblyBalance)) {
        console.error('input stake amount greater than balance: ', prblyBalance);
    } else {
        console.log('stake', inputPRBLY.toLocaleString());
        const gasPrice = await web3.eth.getGasPrice();
        console.log('gas price', web3.utils.fromWei(gasPrice, 'Gwei'));
        stakingContract.methods
            .addStake(inputPRBLY.toString())
            .send({
                from: selectedAccount,
                maxPriorityFeePerGas: null,
                maxFeePerGas: null,
            })
            .on('transactionHash', (hash) => {
                txHash = hash;
                console.log('Hash', hash);
                const inputPRBLYFloat = float18(inputPRBLY);
                const expectedReceiveSPRBLY = getExpectedReceiveSPRBLY();
                HTML_P_STAKE_RECEIPT_MSG.innerText = `Staked ${nfmt(
                    inputPRBLYFloat,
                    2
                )} PRBLY and will receive up to ${nfmt(expectedReceiveSPRBLY, 2)} sPRBLY when transaction confirms.`;
                HTML_P_STAKE_RECEIPT.innerHTML = `Add Stake Tx: <a  target="_blank" href="${blockExplorerBaseURL}${txHash}">${txHash}</a>`;
                HTML_P_STAKE_RECEIPT_MSG.style.display = 'block';
                HTML_P_STAKE_RECEIPT.style.display = 'block';
                HTML_IMG_STAKE.style.display = 'block';
                HTML_TEXT_FIELD_STAKE.value = '0.0';
                onChangeStakeBalance();
                updateConversionBalance();
            })
            .on('receipt', async (receipt) => {
                console.log('Receipt', receipt);
                HTML_P_STAKE_RECEIPT_MSG.innerText = 'Transaction confirmed. Click transaction link below for details.';
                HTML_IMG_STAKE.style.display = 'none';
                await fetchAccountData(provider);
            })
            .on('error', async (error, receipt) => {
                console.error('receipt', receipt);
                console.error(error);
                await fetchAccountData(provider);
            });
    }
}

async function onUnstake() {
    console.log('onUnstake');

    if (inputSPRBLY === 0 || inputSPRBLY.isZero()) {
        console.error('input unstake amount is', inputSPRBLY);
    } else if (inputSPRBLY.gt(sprblyBalance)) {
        console.error('input unstake amount greater than balance: ', sprblyBalance);
    } else {
        console.log('unstake', inputSPRBLY.toLocaleString());
        const gasPrice = await web3.eth.getGasPrice();
        console.log('gas price', web3.utils.fromWei(gasPrice, 'Gwei'));
        stakingContract.methods
            .removeStake(inputSPRBLY.toString())
            .send({
                from: selectedAccount,
                maxPriorityFeePerGas: null,
                maxFeePerGas: null,
            })
            .on('transactionHash', function (hash) {
                txHash = hash;
                console.log('Hash', hash);
                const inputSPRBLYFloat = float18(inputSPRBLY);
                const expectedReceivePRBLY = getExpectedReceivePRBLY();
                HTML_P_UNSTAKE_RECEIPT_MSG.innerText = `Unstaked ${nfmt(
                    inputSPRBLYFloat,
                    2
                )} sPRBLY and will receive up to ${nfmt(expectedReceivePRBLY, 2)} PRBLY when transaction confirms.`;
                HTML_P_UNSTAKE_RECEIPT.innerHTML = `Remove Stake Tx: <a  target="_blank" href="${blockExplorerBaseURL}${txHash}">${txHash}</a>`;
                HTML_P_UNSTAKE_RECEIPT_MSG.style.display = 'block';
                HTML_P_UNSTAKE_RECEIPT.style.display = 'block';
                HTML_IMG_UNSTAKE.style.display = 'block';
                HTML_TEXT_FIELD_UNSTAKE.value = '0.0';
                onChangeUnstakeBalance();
                updateConversionBalance();
            })
            .on('receipt', async function (receipt) {
                console.log('Receipt', receipt);
                HTML_P_UNSTAKE_RECEIPT_MSG.innerText =
                    'Transaction confirmed. Click transaction link below for details.';
                HTML_IMG_UNSTAKE.style.display = 'none';
                await fetchAccountData(provider);
            })
            .on('error', async function (error, receipt) {
                console.error('receipt', receipt);
                console.error(error);
                await fetchAccountData(provider);
            });
    }
}

window.addEventListener('load', async () => {
    init();
    document.querySelector('#btn-connect').addEventListener('click', onConnect);
    HTML_BUTTON_STAKE_CONNECT.addEventListener('click', onConnect);
    HTML_BUTTON_UNSTAKE_CONNECT.addEventListener('click', onConnect);
    document.querySelector('#btn-disconnect').addEventListener('click', onDisconnect);
    //document.querySelector('#addTokenMM').addEventListener('click', onAddToken);
    document.querySelector('#switchNetwork').addEventListener('click', onSwitchNetwork);
    // inputs
    document.querySelector('#stakeMaxButton').addEventListener('click', onStakeMaxButton);
    document.querySelector('#unstakeMaxButton').addEventListener('click', onUnstakeMaxButton);
    HTML_BUTTON_STAKE.addEventListener('click', onStake);
    HTML_BUTTON_STAKE_APPROVE.addEventListener('click', onApproveTokens);
    HTML_BUTTON_UNSTAKE.addEventListener('click', onUnstake);
    HTML_TEXT_FIELD_STAKE.addEventListener('input', onChangeStakeBalance);
    HTML_TEXT_FIELD_UNSTAKE.addEventListener('input', onChangeUnstakeBalance);
});

// get the contract ABI
$.getJSON(prblyAbiURL, function (result) {
    console.log('get PRBLY ABI', result);
    prblyAbi = USE === 'mainnet' ? result.abi : JSON.parse(result.result);
    console.log(prblyAbi);
}).done(function () {
    console.log('PRBLY ABI retrieved!');
});
$.getJSON(stakingAbiURL, function (result) {
    console.log('get sPRBLY ABI', result);
    stakingAbi = USE === 'mainnet' ? JSON.parse(result.result) : result;
    console.log(stakingAbi);
}).done(function () {
    console.log('sPRBLY ABI retrieved!');
});
