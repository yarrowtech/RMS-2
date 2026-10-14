import { API_BASE_URL as APP_API_URL } from "../config/api.js";

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