import { API_BASE_URL as APP_API_URL } from "../config/api.js";
// import axios from "axios";

// const API_BASE = `${APP_API_URL}/grc`;

// export const getAllGrc = async () => {
//   const res = await axios.get(API_BASE + "/");
//   return res.data;
// };

// export const createGrc = async (payload) => {
//   const res = await axios.post(API_BASE + "/", payload);
//   return res.data;
// };

// export const updateGrc = async (id, payload) => {
//   const res = await axios.put(`${API_BASE}/${id}`, payload);
//   return res.data;
// };

// export const deleteGrc = async (id) => {
//   const res = await axios.delete(`${API_BASE}/${id}`);
//   return res.data;
// };

// export const uploadAttachment = async (file) => {
//   const formData = new FormData();
//   formData.append("file", file);
//   const res = await axios.post(API_BASE + "/upload", formData, {
//     headers: { "Content-Type": "multipart/form-data" },
//   });
//   return res.data;
// };

import axios from "axios";
const BASE_URL = `${APP_API_URL}`; 

export const getAllGrc = async () => {
  const res = await axios.get(`${BASE_URL}/grc`);
  return res.data;
};

export const createGrc = async (data) => {
  const res = await axios.post(`${BASE_URL}/grc`, data);
  return res.data;
};

export const getVendors = async () => {
  const response = await axios.get(`${BASE_URL}/vendors/`);
  return response.data;
};