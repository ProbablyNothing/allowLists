'use strict'
// NOTE: NEED TO BE SET FOR CORRECT CONDITIONS!!!
let contactAddress = '0x1259acEc29a6FAfD6f45b768911A28C936E6Cb8e';
let correctChain = 5;
let blockExplorerBaseURL = "https://goerli.etherscan.io/tx/";
let openseaBaseUrl = "https://testnets.opensea.io/account";
let metaLibraryUrl = "https://bookcoin.activehosted.com/f/5";

const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
let web3, chainId, chainData, accounts;
let abi;
let allowList;
let addressInPreSale;
let web3Modal;
let provider;
let selectedAccount;
let displayAddress;
let ensAddress;
let ethersProvider;
let minted, mintable, mintLimit, mintedByAccount, addressCanClaim, canMint;
let code = "YjQxNmVhMjI1NDU5NGUxODkwNDIxYmM4NmE1NjY0ZDY=";
let divStyle = "display: flex; flex-direction: column; align-items: center;";
let lifetimePass;
let mintPrice, allowListPrice;
let transactionHash;
let justMinted = false;

const providerOptions = {
    walletconnect: {
        package: WalletConnectProvider,
        options: {
            infuraId: atob(code),
        }
    }
};
function abiURL(addr) {
    return `https://api${(correctChain === 5) ? '-goerli' : ''}.etherscan.io/api?module=contract&action=getabi&address=${addr}&apikey=DX7KTQFRWXR6PHJEYMP5CZWAT5WQHGIH52`;
}

function resetWeb3Modal() {
    console.log("resetWeb3Modal");
    web3Modal = new Web3Modal({
        cacheProvider: false,
        providerOptions,
        disableInjectedProvider: false,
    });
}

function getProof(address) {
    let addressArray = allowList;
    console.log(address);
    console.log(allowList);
    if (addressArray.find((addr) => addr === address) === address) {
        const leaves = addressArray.map(x => keccak256(x));
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        const buf2hex = x => '0x' + x.toString('hex')
        const leaf = keccak256(address);
        const proof = tree.getProof(leaf).map(x => buf2hex(x.data));
        const root = tree.getRoot().toString('hex')
        console.log("Root: " + root);
        console.log("Proof: " + proof);
        //console.log("Tree:\n" + tree.toString());
        return proof;
    }
    return [];
}

async function fetchAccountData() {
    console.log("fetchAccountData");
    accounts = await web3.eth.getAccounts();
    selectedAccount = accounts[0];
    ensAddress = await ethersProvider.lookupAddress(selectedAccount);
    displayAddress = ensAddress === null ? selectedAccount.slice(0, 6) + "..." + selectedAccount.slice(38, 42) : ensAddress;
    const rowResolvers = accounts.map(async (address) => {
        const balance = await web3.eth.getBalance(address);
        const ethBalance = web3.utils.fromWei(balance, "ether");
        const humanFriendlyBalance = parseFloat(ethBalance).toFixed(4);
    });

    await Promise.all(rowResolvers);

    await getVarsFromContract();

    if (justMinted) {
        let linkToHash = "";
        if (undefined !== transactionHash) { linkToHash = "<a href='" + blockExplorerBaseURL + transactionHash + ">Link to Tx</a>"; }
        showCantMintReasonOrResult("Mint in progress." + linkToHash);
    }
    // collection is minted out
    else if (minted >= mintable) {
        showAllBooksMinted()
    }
    // user can claim
    else if (addressCanClaim) {
        showAllowListButton(true);
    }
    // user can mint
    else if (canMint) {
        showMintButton(true);
    }
    else if (!canMint) {
        showCantMintReasonOrResult("Minting is not open.")
    }
    // all other cases assume they can't mint
    else {
        showCantMintReasonOrResult("You are not able to mint yet.")
    }

    showConnectedState();
}

function setUItoInitialState() {
    console.log("setUItoInitialState");
    document.querySelector("#mintDiv").style.display = "none";
    showDisconnectedState();
}

function showDisconnectedState() {
    console.log("showDisconnectedState");
    document.querySelector("#connectMessage").setAttribute("style", divStyle);
    document.querySelector("#connectedMessage").style.display = "none";
    document.querySelector("#addressTextBox").innerHTML = "";
    document.querySelector("#claim").setAttribute("style", "display:none;");
}

function showConnectedState() {
    console.log("showConnectedState");
    document.querySelector("#connectMessage").style.display = "none";
    document.querySelector("#connectedMessage").setAttribute("style", "display:flex;margin-top:15px;justify-content space-around;align-items:center;-webkit-box-align:center;");
    document.querySelector("#addressTextBox").innerHTML = displayAddress;
    document.querySelector("#remainingCounts").innerHTML = `${minted} / ${mintable} Remaining`;
}

function showSwitchNetwork(show) {
    console.log("showSwitchNetwork: " + show.toString());
    document.querySelector("#connectMessage").style.display = "none";
    document.querySelector("#mintDiv").style.display = "none";
    document.querySelector("#switchNetwork").setAttribute("style", show ? divStyle : "display:none");
    //if (show) { showAllowListButton(false) };
}

function showCantMintReasonOrResult(txMessage) {
    console.log("showReasonOrResult");
    showMintButton(false);
    showAllowListButton(false);
    document.querySelector("#transactionMessage").setAttribute("style", divStyle);
    document.getElementById("txInfoMessage").innerHTML = txMessage;
}

function showAllowListButton(show) {
    console.log("showClaimButton: " + show.toString());
    if (show) {
        document.querySelector("#mintDiv").setAttribute("style", show ? "display:none;" : divStyle);
    }
    document.querySelector("#claim").setAttribute("style", show ? divStyle : "display:none;");
}

function showMintButton(show) {
    console.log("showMintButton: " + show.toString());
    if (show) {
        document.querySelector("#claim").setAttribute("style", "display:none;");
    }
    document.querySelector("#mintDiv").setAttribute("style", show ? divStyle : "display:none;");
}

function showAllBooksMinted() {
    console.log("showAllBooksMinted");
    document.querySelector("#mintDiv").setAttribute("style", divStyle);
}

function showTransactionProcessing(txMessage, txHash) {
    console.log('showTransactionProcessing');
    let etherscanLink = blockExplorerBaseURL + txHash;
    console.log(etherscanLink);
    showMintButton(false);
    showAllowListButton(false);
    document.querySelector("#transactionLinkDiv").style.display = "block";
    document.querySelector("#transactionMessage").setAttribute("style", divStyle);
    document.getElementById("txInfoMessage").innerHTML = txMessage;
    document.getElementById("transactionLink").setAttribute("href", etherscanLink);
    document.querySelector("#openseaMessage").style.display = "none";
    document.getElementById("openseaLink").setAttribute("href", "");
}

function hideTransactionProcessing() {
    console.log('hideTransactionProcessing');
    document.getElementById("txInfoMessage").innerHTML = "";
    document.querySelector("#transactionLinkDiv").style.display = "none";
    document.getElementById("transactionLink").setAttribute("href", "");
    document.getElementById("transactionMessage").style.display = "none";
    showMintButton(false);
    showAllowListButton(false);
    document.querySelector("#openseaMessage").setAttribute("style", divStyle);
    document.getElementById("openseaLink").setAttribute("href", openseaBaseUrl);
    setTimeout(() => { document.querySelector("#openseaMessage").style.display = "none"; fetchAccountData(); }, 10000);
}


async function getVarsFromContract() {
    console.log("getVarsFromContract")
    await lifetimePass.methods.totalSupply().call({ from: selectedAccount })
        .then(function (result) {
            minted = result;
            console.log("minted: " + result);
        });
    await lifetimePass.methods.maxSupply().call({ from: selectedAccount })
        .then(function (result) {
            mintable = parseInt(result);
            console.log("mintable: " + result);
        });

    await lifetimePass.methods.canAllowListMint(selectedAccount, getProof(selectedAccount)).call({ from: selectedAccount })
        .then(function (result) {
            addressCanClaim = result;
            console.log("addressCanClaim: " + addressCanClaim);
        });

    await lifetimePass.methods.mintOpen().call({ from: selectedAccount })
        .then(function (result) {
            canMint = result;
            console.log("addressCanMint: " + addressCanClaim);
        });

    await lifetimePass.methods.mintPrice().call({ from: selectedAccount })
        .then(function (result) {
            mintPrice = result;
            console.log("mintPrice: " + mintPrice);
        });

    await lifetimePass.methods.allowListMintPrice().call({ from: selectedAccount })
        .then(function (result) {
            allowListPrice = result;
            console.log("allowListMintPrice: " + allowListPrice);
        });
}

/**
* Connect wallet button pressed.
*/
async function onConnect() {
    console.log("onConnect")
    try {
        provider = await web3Modal.connect();
        ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        web3 = new Web3(provider);
        chainId = await web3.eth.getChainId();
        chainData = evmChains.getChain(chainId);
        console.log("before getting contract");
        lifetimePass = new web3.eth.Contract(
            abi,
            contactAddress
        );
        console.log("after getting contract");

    } catch (e) {
        console.log("Something went wrong during connection:\n ", e);
        return;
    }

    showSwitchNetwork(chainId !== correctChain);
    provider.on("accountsChanged", async (accounts) => {
        console.log("accountChanged");
        await fetchAccountData(provider);
    });

    provider.on("chainChanged", async (newChainId) => {
        chainId = parseInt(newChainId, 16);
        resetWeb3Modal();
        showSwitchNetwork(chainId !== correctChain);
        await fetchAccountData(provider);
    });

    provider.on("error", async (error) => {
        console.log("error");
        resetWeb3Modal();
        await fetchAccountData(provider);
        console.log(error);
    });
    await fetchAccountData(provider);
}

async function onDisconnect() {
    console.log("onDisconnect");
    if (provider && provider.disconnect) {
        await provider.disconnect();
        await web3Modal.clearCachedProvider();
        provider = null;
    }
    resetWeb3Modal();

    selectedAccount = null;

    setUItoInitialState();
}


async function onMint() {
    console.log("onMint");
    justMinted = true;
    showAllowListButton(false);

    lifetimePass.methods.mint().send({
        from: selectedAccount,
        value: mintPrice,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
    })
        .on('transactionHash', function (hash) {
            transactionHash = hash;
            showTransactionProcessing("Minting...", hash)
            console.log("Hash " + hash)
        })
        .on('receipt', async function (receipt) {
            console.log("Receipt " + receipt.toString());
            hideTransactionProcessing();
            justMinted = false;
            await fetchAccountData(provider);
        })
        .on('error', async function (error, receipt) {
            console.log("Receipt " + receipt + "\nError: " + error);
            justMinted = false;
            await fetchAccountData(provider);
        })

    await fetchAccountData(provider);
}


async function onAllowListMint() {
    console.log("onAllowListMint");
    justMinted = true;
    showAllowListButton(false);
    let proof = getProof(selectedAccount);

    lifetimePass.methods.allowListMint(proof).send({
        from: selectedAccount,
        value: allowListPrice,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
    })
        .on('transactionHash', function (hash) {
            transactionHash = hash;
            showTransactionProcessing("Claiming...", hash)
            console.log("Hash " + hash)
        })
        .on('receipt', async function (receipt) {
            console.log("Receipt " + receipt.toString());
            setTimeout(function () {
                hideTransactionProcessing();
            }, 5000);
            justMinted = false;
            await fetchAccountData(provider);
        })
        .on('error', async function (error, receipt) {
            console.log("Receipt " + receipt + "\nError: " + error);
            justMinted = false;
            await fetchAccountData(provider);
        })

    await fetchAccountData(provider);
}

async function onSwitchNetwork() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: Web3.utils.toHex(correctChain) }],
    });
}

window.addEventListener('load', async () => {
    resetWeb3Modal();
    document.querySelector("#connectButton").addEventListener("click", onConnect);
    document.querySelector("#disconnectButton").addEventListener("click", onDisconnect);
    document.querySelector("#mintButton").addEventListener("click", onMint);
    document.querySelector("#claimButton").addEventListener("click", onAllowListMint);
    document.querySelector("#switchNetwork").addEventListener("click", onSwitchNetwork);
});

// get the contract ABI
$.getJSON(abiURL(contactAddress), function (result) {
    console.log("#get contract abi");
    //console.log(abiURL(contactAddress))
    //console.log('get LP ABI', result);
    abi = JSON.parse(result.result);
    console.log(abi);
}).done(function () {
    console.log('LP ABI retrieved!');
});

$.getJSON("https://raw.githubusercontent.com/ProbablyNothing/allowLists/main/LifetimePass/allowList.json", function (result) {
    console.log("#get claim list");
    allowList = result.allowlist;
    console.log(allowList);
})
    .done(function () {
        console.log("claim list retrieved!");
    });
