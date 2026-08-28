"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext({
  items: [],
  cartOpen: false,
  setCartOpen: () => {},
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  subtotal: 0
});

const CART_STORAGE_KEY = "concierge_cart_items";

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load cart from storage", e);
    }
  }, []);

  const saveItems = (newItems) => {
    setItems(newItems);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    } catch (e) {
      console.error("Failed to save cart", e);
    }
  };

  const addToCart = (book, quantity = 1) => {
    const existingIndex = items.findIndex((i) => i.id === book.id);
    let updated;
    if (existingIndex >= 0) {
      updated = [...items];
      updated[existingIndex].quantity += quantity;
    } else {
      updated = [
        ...items,
        {
          id: book.id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          retailPrice: book.retailPrice,
          vendorPrice: book.vendorPrice,
          sourceVendor: book.sourceVendor,
          sourceUrl: book.sourceUrl,
          quantity: quantity
        }
      ];
    }
    saveItems(updated);
    setCartOpen(true);
  };

  const removeFromCart = (bookId) => {
    const updated = items.filter((i) => i.id !== bookId);
    saveItems(updated);
  };

  const updateQuantity = (bookId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(bookId);
      return;
    }
    const updated = items.map((i) => (i.id === bookId ? { ...i, quantity } : i));
    saveItems(updated);
  };

  const clearCart = () => {
    saveItems([]);
  };

  const totalItems = items.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  const subtotal = items.reduce((acc, curr) => acc + curr.retailPrice * (curr.quantity || 1), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartOpen,
        setCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
