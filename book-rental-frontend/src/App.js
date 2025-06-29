import React, { useState, useEffect } from "react";
import Web3 from "web3";
import ContractAddress from "./config/contractAddress.json";
import YourContractABI from "./abis/BookRental.json";
import BN from "bn.js";
import './App.css';

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractOwner, setContractOwner] = useState(null);
  const [books, setBooks] = useState([]);
  const [bookTitle, setBookTitle] = useState("");
  const [dailyPrice, setDailyPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [refundAmount, setRefundAmount] = useState("0");

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setAccount(accounts[0]);
        loadBlockchainData();
      } catch (err) {
        console.error("Connection rejected:", err);
      }
    } else {
      alert("Please install MetaMask.");
    }
  };

  const loadBlockchainData = async () => {
    if (window.ethereum) {
      try {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);

        const accounts = await web3Instance.eth.getAccounts();
        if (accounts.length === 0) return;

        const currentAccount = accounts[0];
        setAccount(currentAccount);

        const networkId = await web3Instance.eth.net.getId();
        const contractAddress = ContractAddress[networkId];
        if (!contractAddress) {
          alert("Smart contract not deployed to this network.");
          return;
        }

        const contractInstance = new web3Instance.eth.Contract(
          YourContractABI.abi,
          contractAddress
        );
        setContract(contractInstance);

        const owner = await contractInstance.methods.owner().call();
        setContractOwner(owner);

        const activeIds = await contractInstance.methods.getActiveBookIds().call();
        const booksArray = [];
        for (const id of activeIds) {
          const book = await contractInstance.methods.books(id).call();
          const rental = await contractInstance.methods.rentals(id).call();
          booksArray.push({ ...book, index: Number(id), rental });
        }
        setBooks(booksArray);
      } catch (err) {
        console.error("Blockchain load error:", err);
      }
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          loadBlockchainData();
        }
      });
    }
  }, [contract]);

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const listBook = async () => {
    if (!bookTitle || !dailyPrice || !deposit) {
      alert("Fill in all fields.");
      return;
    }

    if (!contract) {
      alert("Contract not loaded yet. Please wait.");
      return;
    }

    try {
      const dailyPriceInWei = web3.utils.toWei(dailyPrice.toString(), "ether");
      const depositInWei = web3.utils.toWei(deposit.toString(), "ether");

      await contract.methods
        .listItem(bookTitle, dailyPriceInWei, depositInWei)
        .send({ from: account });

      alert("Book listed.");
      setBookTitle("");
      setDailyPrice("");
      setDeposit("");
      loadBlockchainData();
    } catch (err) {
      console.error("List Error:", err);
      alert("List failed.");
    }
  };

  const unlistBook = async (itemId) => {
    try {
      await contract.methods.unlistItem(itemId).send({ from: account });
      setBooks(prev => prev.filter(book => book.index !== itemId));
    } catch (err) {
      alert("Unlist failed.");
    }
  };

  const rentBook = async (index) => {
    const book = books.find(b => b.index === index);
    if (!book) return;

    const total = new BN(book.dailyPrice).add(new BN(book.deposit));
    try {
      await contract.methods.rentItem(index).send({ from: account, value: total.toString() });
      alert("Book rented.");
      loadBlockchainData();
    } catch (err) {
      alert("Rent failed.");
    }
  };

  const returnBook = async (id) => {
    try {
      const book = books.find(b => b.index === id);
      if (!book) return;

      const rentedAt = Number(book.rental.rentedAt) * 1000;
      const elapsed = Math.floor((Date.now() - rentedAt) / 60000);
      let penaltyWei = new BN(0);

      if (elapsed > 5) penaltyWei = new BN(book.deposit);
      else if (elapsed > 1) {
        const penaltyEth = (elapsed - 1) * parseFloat(web3.utils.fromWei(book.dailyPrice, "ether"));
        penaltyWei = new BN(web3.utils.toWei(penaltyEth.toString(), "ether"));
      }

      await contract.methods.returnItem(id).send({ from: account });
      alert("Returned book.");
      loadBlockchainData();
    } catch (err) {
      alert("Return failed.");
    }
  };

  const withdrawRefund = async () => {
    try {
      await contract.methods.withdrawRefund().send({ from: account });
      alert("Refund withdrawn.");
      loadBlockchainData();
    } catch (err) {
      alert("Withdraw failed.");
    }
  };

  const checkRefund = async () => {
    if (contract && account) {
      const amount = await contract.methods.pendingRefunds(account).call();
      setRefundAmount(web3.utils.fromWei(amount.toString(), 'ether'));
    }
  };

  useEffect(() => {
    if (contract && account) checkRefund();
  }, [contract, account]);

 return (
  <div className="app-container">
    <header className="app-header">
      <h1 className="app-title">
        <span className="gradient-text">Decentralized Book Rental</span>
      </h1>
      <div className="wallet-info">
        {!account ? (
          <button onClick={connectWallet} className="btn primary-btn">Connect Wallet</button>
        ) : (
          <>
            <span className="wallet-label">Connected:</span>
            <span className="wallet-address">{account}</span>
          </>
        )}
      </div>
    </header>

    <main className="app-main">
      {account && (
        <>
          {/* 📚 Book Listing Section */}
          <div className="dashboard-grid">
            <div className="glass-card">
              <div className="card-header"><h2>List a New Book</h2></div>
              <div className="form-group">
                <input value={bookTitle} onChange={e => setBookTitle(e.target.value)} placeholder="Title" />
                <input value={dailyPrice} onChange={e => setDailyPrice(e.target.value)} placeholder="Daily Price (ETH)" />
                <input value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="Deposit (ETH)" />
                <button onClick={listBook} className="btn primary-btn">List Book</button>
              </div>
            </div>
          </div> {/* ✅ Fix: Closed the dashboard-grid */}

          {/* 📚 All Books Section */}
          <div className="glass-card">
            <div className="card-header"><h2>All Books</h2></div>
            <div className="book-list books-scroll-container">
              {books.map(book => (
                <div key={book.index} className="book-card">
                  <p><strong>{book.title}</strong></p>
                  <p>
                    Rent: {book.dailyPrice ? web3?.utils.fromWei(book.dailyPrice.toString(), 'ether') : 'N/A'} ETH/day +{" "}
                    {book.deposit ? web3?.utils.fromWei(book.deposit.toString(), 'ether') : 'N/A'} ETH deposit
                  </p>
                  <p>Status: {book.isAvailable ? "Available" : "Rented"}</p>
                  {book.isAvailable && book.owner.toLowerCase() === account?.toLowerCase() ? (
                    <button onClick={() => unlistBook(book.index)} className="btn danger-btn">Unlist</button>
                  ) : !book.isAvailable ? (
                    <p className="disabled-text">Cannot unlist</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* 📚 Available & Rented Sections */}
          <div className="dashboard-grid">
            {/* Available Books */}
            <div className="glass-card">
              <div className="card-header"><h2>Available Books</h2></div>
              <div className="books-scroll-container">
                {books.filter(book => book.isAvailable && book.owner.toLowerCase() !== account?.toLowerCase()).length > 0 ? (
                  books
                    .filter(book => book.isAvailable && book.owner.toLowerCase() !== account?.toLowerCase())
                    .map(book => (
                      <div key={book.index} className="book-card">
                        <p><strong>{book.title}</strong></p>
                        <p>
                          Rent: {book.dailyPrice ? web3?.utils.fromWei(book.dailyPrice.toString(), 'ether') : 'N/A'} ETH/day +{" "}
                          {book.deposit ? web3?.utils.fromWei(book.deposit.toString(), 'ether') : 'N/A'} ETH deposit
                        </p>
                        <button onClick={() => rentBook(book.index)} className="btn primary-btn small-button">Rent</button>
                      </div>
                    ))
                ) : (
                  <p>No available books to rent.</p>
                )}
              </div>
            </div>

            {/* Rented Books */}
            <div className="glass-card">
              <div className="card-header"><h2>Rented by You</h2></div>
              <div className="books-scroll-container">
                {books.filter(book =>
                  !book.isAvailable &&
                  book.rental.renter.toLowerCase() === account?.toLowerCase()
                ).length > 0 ? (
                  books
                    .filter(book =>
                      !book.isAvailable &&
                      book.rental.renter.toLowerCase() === account?.toLowerCase()
                    )
                    .map(book => (
                      <div key={book.index} className="book-card">
                        <p><strong>{book.title}</strong></p>
                        <p>Rented At: {new Date(Number(book.rental.rentedAt) * 1000).toLocaleTimeString()}</p>
                        <p>Elapsed: {Math.floor((Date.now() - Number(book.rental.rentedAt) * 1000) / 60000)} min</p>
                        <button onClick={() => returnBook(book.index)} className="btn primary-btn">Return</button>
                      </div>
                    ))
                ) : (
                  <p>You haven't rented any books.</p>
                )}
              </div>
            </div>
          </div>

          {/* 💸 Refund Section */}
          {parseFloat(refundAmount) > 0 && (
            <div className="centered-refund-banner">
              <p>Pending Refund: {refundAmount} ETH</p>
              <button onClick={withdrawRefund} className="btn primary-btn">Withdraw Refund</button>
            </div>
          )}
        </>
      )}
    </main>

    <footer className="app-footer">
      <p>© {new Date().getFullYear()} BookRental DApp</p>
    </footer>
  </div>
);

export default App;
