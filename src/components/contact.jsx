import React, { useState } from 'react';
import axios from 'axios';

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://formspree.io/f/mnnakpbj', formData);  // Update the endpoint to match your backend setup
      console.log('Server response:', response);
      setStatusMessage('Your message has been sent successfully! I will get back to you soon.');
      setIsSubmitted(true);
      setFormData({
        name: '',
        email: '',
        message: '',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setStatusMessage('There was an error sending your message. Please try again.');
    }
  };

  return (
    <div className="max-w-lg mx-auto lg:mb-4 p-4 border-gray-950  rounded-lg shadow-lg">
      {statusMessage && (
        <p className="text-center mb-6 text-yellow-300 font-semibold">
          {statusMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your Name"
            required
            className="w-full px-4 lg:py-3 py-2 bg-transparent border border-slate-600 text-white rounded-md placeholder-gray-300 transition-colors hover:border-slate-500 focus:outline-none focus:border-teal-300 focus:ring-1 focus:ring-teal-300"
          />
        </div>
        <div>
          <input
            type="email"
            name="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Your Email"
            required
            className="w-full px-4 lg:py-3 py-2 bg-transparent border border-slate-600 text-white rounded-md placeholder-gray-300 transition-colors hover:border-slate-500 focus:outline-none focus:border-teal-300 focus:ring-1 focus:ring-teal-300"
          />
        </div>
        <div>
          <textarea
            name="message"
            id="message"
            rows="5"
            value={formData.message}
            onChange={handleChange}
            placeholder="How can I assist you? Type your query or service request here..."
            required
            className="w-full px-4 lg:py-3 py-2 bg-transparent border border-slate-600 text-white rounded-md placeholder-gray-300 transition-colors hover:border-slate-500 focus:outline-none focus:border-teal-300 focus:ring-1 focus:ring-teal-300"
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full lg:py-3 py-2 bg-slate-800 text-slate-200 hover:text-white font-semibold rounded-md hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Send Message
        </button>
      </form>
      {isSubmitted && (
        <p className="text-center text-sm text-white lg:mt-4 mt-2">
          Thanks for reaching out!
        </p>
      )}
    </div>
  );
}

export default Contact;
