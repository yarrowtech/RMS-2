import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import axios from "axios";

const BASE_URL = `${APP_API_URL}/tasklist`; // change if deployed

export const getAllTasks = async () => {
  const res = await axios.get(`${BASE_URL}/`);
  return res.data;
};

export const createTask = async (payload) => {
  const res = await axios.post(`${BASE_URL}/`, payload);
  return res.data;
};

export const updateTask = async (id, payload) => {
  const res = await axios.put(`${BASE_URL}/${id}`, payload);
  return res.data;
};

export const deleteTask = async (id) => {
  const res = await axios.delete(`${BASE_URL}/${id}`);
  return res.data;
};

export const uploadTaskFiles = async (id, { communicationFiles = [], imageFiles = [] }) => {
  const formData = new FormData();
  communicationFiles.forEach((f) => formData.append("communication_files", f));
  imageFiles.forEach((f) => formData.append("image_files", f));

  const res = await axios.post(`${BASE_URL}/${id}/upload-files`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
