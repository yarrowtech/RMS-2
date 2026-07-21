import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Star, Send, Building2, Package, CreditCard, Store,
  User, Phone, MapPin, Clock, IndianRupee, CheckCircle2,
  ChevronRight, ChevronLeft, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE_URL = APP_API_URL;
const QUESTIONNAIRE_TENANT_ID = new URLSearchParams(window.location.search).get("tenant") || "";

const STEPS = [
  { id: 1, label: 'General',     icon: Building2,   color: '#6366f1' },
  { id: 2, label: 'Products',    icon: Package,     color: '#0ea5e9' },
  { id: 3, label: 'Commercial',  icon: CreditCard,  color: '#f59e0b' },
  { id: 4, label: 'Brand',       icon: Store,       color: '#10b981' },
];

const VendorQuestion = () => {
  const initialFormState = {
    vendorName: '', contactPerson: '', phoneNumber: '', email: '',cityLocation: '',
    businessType: '', businessTypeOther: '',
    productCategory: '', images: [], vendorQuality: 0,
    moq: '', priceRange: '', leadTime: '',
    paymentTerms: '', brandSection: '', onlineCollaboration: '',
  };

  const [formData,     setFormData]     = useState(initialFormState);
  const [previews,     setPreviews]     = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [currentStep,  setCurrentStep]  = useState(1);
  const totalSteps = 4;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setQualityRating = (rating) =>
    setFormData(prev => ({ ...prev, vendorQuality: rating }));

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFormData(prev => ({ ...prev, images: [...prev.images, ...files] }));
    setPreviews(prev => [...prev, ...files.map(f => ({
      name: f.name, size: f.size, url: URL.createObjectURL(f), type: f.type,
    }))]);
    toast.success(`${files.length} file(s) added`);
  }

  function removeFile(idx) {
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  const handleNext = () => {
    if (currentStep === 1 && !formData.vendorName) { toast.error('Vendor Name is required'); return; }
    if (currentStep === 2 && formData.images.length === 0) { toast.error('Please upload at least one image'); return; }
    if (currentStep === 3 && !formData.moq) { toast.error('MOQ is required'); return; }
    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!formData.vendorName || formData.images.length === 0 || !formData.moq) {
      toast.error('Please fill all required fields (*)'); return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('vendorName',          formData.vendorName);
      fd.append('contactPerson',       formData.contactPerson);
      fd.append('phoneNumber',         formData.phoneNumber);
      fd.append('email',               formData.email || '');
      fd.append('cityLocation',        formData.cityLocation);
      fd.append('businessType',        formData.businessType !== 'Other:' ? formData.businessType : formData.businessTypeOther);
      fd.append('productCategory',     formData.productCategory);
      fd.append('vendorQuality',       String(formData.vendorQuality));
      fd.append('moq',                 formData.moq);
      fd.append('priceRange',          formData.priceRange);
      fd.append('leadTime',            formData.leadTime);
      fd.append('paymentTerms',        formData.paymentTerms);
      fd.append('brandSection',        formData.brandSection);
      fd.append('onlineCollaboration', formData.onlineCollaboration);
      if (QUESTIONNAIRE_TENANT_ID) fd.append('tenantId', QUESTIONNAIRE_TENANT_ID);
      formData.images.forEach(img => fd.append('images', img));

      const res  = await fetch(`${API_BASE_URL}/api/vendors/questionnaire`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Submission failed');
      toast.success('Submitted successfully!');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const slide = {
    hidden:  { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0,   transition: { duration: 0.35, ease: 'easeOut' } },
    exit:    { opacity: 0, x: -32, transition: { duration: 0.25 } },
  };

  const activeStep = STEPS[currentStep - 1];

  /* ══ Success ══ */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white text-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
          </div>
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">Application Submitted!</h2>
        <p className="text-slate-300 mb-2 max-w-sm text-sm sm:text-base">
          Thank you for your interest in partnering with CitiMart.
        </p>
        <p className="text-slate-400 max-w-sm text-sm">
          Our team will review your application and reach out via WhatsApp and Email within 2–3 business days.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 py-8 px-4 font-sans">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
            Vendor Questionnaire
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
            Help us understand your business. Fill in the details below to get started with CitiMart.
          </p>
        </motion.div>

        {/* ── Step indicators ── */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const done    = currentStep > s.id;
            const active  = currentStep === s.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    done   ? 'bg-green-500 shadow-md shadow-green-200' :
                    active ? 'shadow-lg'                                :
                             'bg-slate-200'
                  }`}
                    style={active ? { backgroundColor: s.color, boxShadow: `0 4px 14px ${s.color}55` } : {}}>
                    {done
                      ? <CheckCircle2 className="w-5 h-5 text-white" />
                      : <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${active ? 'text-white' : 'text-slate-400'}`} />}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-semibold ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-12 rounded-full mb-4 transition-colors duration-300 ${currentStep > s.id ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-6 px-1">
          <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{ backgroundColor: activeStep.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">

          {/* Card header strip */}
          <div className="px-5 py-4 flex items-center gap-3"
            style={{ background: `linear-gradient(135deg, ${activeStep.color}ee, ${activeStep.color}99)` }}>
            {React.createElement(activeStep.icon, { className: 'w-5 h-5 text-white/80 shrink-0' })}
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">
                Step {currentStep}
              </p>
              <h2 className="text-white font-bold text-base leading-tight">
                {currentStep === 1 && 'General Information'}
                {currentStep === 2 && 'Product & Quality'}
                {currentStep === 3 && 'Commercial Details'}
                {currentStep === 4 && 'Brand & Collaboration'}
              </h2>
            </div>
          </div>

          {/* Card body */}
          <div className="p-5 sm:p-7">
            <AnimatePresence mode="wait">

              {/* ══ STEP 1 ══ */}
              {currentStep === 1 && (
                <motion.div key="s1" variants={slide} initial="hidden" animate="visible" exit="exit"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  <Field label="Vendor Name *" icon={<Building2 className="h-4 w-4 text-slate-400" />}>
                    <input type="text" name="vendorName" value={formData.vendorName}
                      onChange={handleInputChange} placeholder="Company name" className={INP} />
                  </Field>

                  <Field label="Contact Person" icon={<User className="h-4 w-4 text-slate-400" />}>
                    <input type="text" name="contactPerson" value={formData.contactPerson}
                      onChange={handleInputChange} placeholder="Full name" className={INP} />
                  </Field>

                  <Field label="Phone Number" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                    <input type="tel" name="phoneNumber" value={formData.phoneNumber}
                      onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); handleInputChange(e); }}
                      maxLength={10} placeholder="10-digit mobile" className={INP} />
                  </Field>
                 
                  <Field label="Email (optional)" icon={<User className="h-4 w-4 text-slate-400" />}>
                    <input type="email" name="email" value={formData.email}
                      onChange={handleInputChange} placeholder="vendor@company.com" className={INP} />
                  </Field>



                  <Field label="City & Location" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
                    <input type="text" name="cityLocation" value={formData.cityLocation}
                      onChange={handleInputChange} placeholder="City, State" className={INP} />
                  </Field>

                  <div className="sm:col-span-2 space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Type of Business</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['MANUFACTURER', 'WHOLE SELLER', 'EXPORTER', 'Other:'].map(t => (
                        <RadioPill key={t} name="businessType" value={t}
                          checked={formData.businessType === t} onChange={handleInputChange} label={t}
                          color={activeStep.color} />
                      ))}
                    </div>
                    <AnimatePresence>
                      {formData.businessType === 'Other:' && (
                        <motion.input initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          type="text" name="businessTypeOther" value={formData.businessTypeOther}
                          onChange={handleInputChange} placeholder="Please specify"
                          className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 bg-slate-50 text-sm outline-none" />
                      )}
                    </AnimatePresence>
                  </div>

                </motion.div>
              )}

              {/* ══ STEP 2 ══ */}
              {currentStep === 2 && (
                <motion.div key="s2" variants={slide} initial="hidden" animate="visible" exit="exit"
                  className="space-y-7">

                  {/* Category */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Product Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['MEN', 'WOMEN', 'KIDS', 'ALL'].map(cat => (
                        <RadioPill key={cat} name="productCategory" value={cat}
                          checked={formData.productCategory === cat} onChange={handleInputChange} label={cat}
                          color={activeStep.color} />
                      ))}
                    </div>
                  </div>

                  {/* Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                      Card Image &amp; Product Images <span className="text-red-500">*</span>
                    </label>
                    <label htmlFor="q-file-upload"
                      className="flex flex-col items-center justify-center gap-3 px-5 py-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-sky-400 hover:bg-sky-50/40 transition-all cursor-pointer group">
                      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                        <Upload className="h-6 w-6 text-sky-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-600">
                          <span className="text-sky-500">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, PDF — up to 10MB each</p>
                      </div>
                    </label>
                    <input id="q-file-upload" type="file" multiple accept="image/*,.pdf"
                      className="hidden" onChange={handleFileChange} />

                    {previews.length > 0 && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {previews.map((p, i) => (
                            <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                              {p.type.startsWith('image/') ? (
                                <img src={p.url} alt={p.name} className="w-full h-20 object-cover" />
                              ) : (
                                <div className="w-full h-20 flex flex-col items-center justify-center bg-indigo-50">
                                  <Package size={22} className="text-indigo-400" />
                                  <span className="text-[10px] text-indigo-500 font-medium mt-1">PDF</span>
                                </div>
                              )}
                              <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                                <p className="text-[10px] text-slate-500 truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{(p.size / 1024).toFixed(0)} KB</p>
                              </div>
                              <button type="button" onClick={() => removeFile(i)}
                                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <label htmlFor="q-file-upload"
                            className="h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors">
                            <Upload size={18} className="text-slate-300 mb-1" />
                            <span className="text-[10px] text-slate-400 font-medium">Add more</span>
                          </label>
                        </div>
                        <p className="text-xs text-green-600 font-semibold">✓ {previews.length} file(s) ready</p>
                      </>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Vendor Quality Rating</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => setQualityRating(star)}
                          className="flex flex-col items-center gap-1 focus:outline-none group">
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600">{star}</span>
                          <Star className={`w-9 h-9 transition-all duration-150 ${
                            star <= formData.vendorQuality ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-200 hover:text-amber-300'
                          }`} />
                        </button>
                      ))}
                      {formData.vendorQuality > 0 && (
                        <span className="ml-2 text-sm font-bold text-amber-500">{formData.vendorQuality}/5</span>
                      )}
                    </div>
                  </div>

                </motion.div>
              )}

              {/* ══ STEP 3 ══ */}
              {currentStep === 3 && (
                <motion.div key="s3" variants={slide} initial="hidden" animate="visible" exit="exit"
                  className="space-y-6">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="MOQ (Minimum Order Qty) *" icon={<Package className="h-4 w-4 text-slate-400" />}>
                      <input type="text" name="moq" value={formData.moq}
                        onChange={handleInputChange} placeholder="e.g. 500 units" className={INP} />
                    </Field>
                    <Field label="Price Range" icon={<IndianRupee className="h-4 w-4 text-slate-400" />}>
                      <input type="text" name="priceRange" value={formData.priceRange}
                        onChange={handleInputChange} placeholder="e.g. ₹500 – ₹2000" className={INP} />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" /> Production Lead Time
                    </label>
                    <textarea name="leadTime" value={formData.leadTime} onChange={handleInputChange}
                      rows={3} placeholder="e.g. 15–20 days. Please provide details."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-slate-50 text-sm outline-none resize-none" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Payment Terms</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {['ADVANCE', 'PDC', 'CREDIT 45 - 60 DAYS'].map(term => (
                        <RadioPill key={term} name="paymentTerms" value={term}
                          checked={formData.paymentTerms === term} onChange={handleInputChange} label={term}
                          color={activeStep.color} />
                      ))}
                    </div>
                  </div>

                </motion.div>
              )}

              {/* ══ STEP 4 ══ */}
              {currentStep === 4 && (
                <motion.div key="s4" variants={slide} initial="hidden" animate="visible" exit="exit"
                  className="space-y-7">

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Brand Section</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['CITI MART', 'RAPHAAA', 'NP', 'MIX'].map(brand => (
                        <RadioPill key={brand} name="brandSection" value={brand}
                          checked={formData.brandSection === brand} onChange={handleInputChange} label={brand}
                          color={activeStep.color} />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Online Collaboration</label>
                    <div className="flex gap-3">
                      {['YES', 'No'].map(opt => (
                        <RadioPill key={opt} name="onlineCollaboration" value={opt}
                          checked={formData.onlineCollaboration === opt} onChange={handleInputChange} label={opt}
                          color={activeStep.color} wide />
                      ))}
                    </div>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button type="button" onClick={handlePrev}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-50 shadow-sm transition-all">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
          ) : <div />}

          {currentStep < totalSteps ? (
            <button type="button" onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 text-white font-bold text-sm rounded-xl shadow-md transition-all hover:opacity-90 hover:shadow-lg"
              style={{ backgroundColor: activeStep.color, boxShadow: `0 4px 14px ${activeStep.color}55` }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold text-sm rounded-xl shadow-md hover:bg-green-700 transition-all disabled:opacity-60">
              {isSubmitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              {isSubmitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>

        {/* Step hint */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Step {currentStep} of {totalSteps} — {STEPS[currentStep - 1].label}
        </p>

      </div>
    </div>
  );
};

/* ── shared ── */
const INP = 'block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none hover:bg-white transition-colors';

function Field({ label, icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">{icon}</div>
        {children}
      </div>
    </div>
  );
}

function RadioPill({ name, value, checked, onChange, label, color, wide }) {
  return (
    <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-semibold select-none
      ${wide ? 'flex-1 justify-center' : ''}
      ${checked
        ? 'border-transparent text-white shadow-md'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
      style={checked ? { backgroundColor: color, boxShadow: `0 2px 10px ${color}44` } : {}}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
      {label}
    </label>
  );
}

export default VendorQuestion;
