import React from "react";
import { FaEnvelope, FaPhoneAlt } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-gray-900 bg-opacity-20 text-gray-400 py-8 px-4">
      <div className="container mx-auto">
        <div className="grid grid-col-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 text-left mb-6">
          <div className="col-span-2">
            <h3 className="text-white font-semibold mb-2">Contact Information</h3>
            <p className="mb-1 flex flex-wrap items-center gap-x-2">
              <FaEnvelope className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
              <span>Email:</span>
              <a
                href="mailto:jkrkumar1801@gmail.com"
                className="text-gray-300"
              >
                jayakumarjayakrishnanjk@gmail.com
              </a>
            </p>
            <p className="mb-1 flex flex-wrap items-center gap-x-2">
              <FaPhoneAlt className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
              <span>Phone:</span>
              <a href="tel:+919514101822" className="text-gray-300">
                +91 9514101822
              </a>
            </p>
          </div>

        </div>

        {/* Copyright Bar */}
        <div className="border-t border-gray-700 pt-4 text-center w-full">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Jayakumar's Portfolio. All Rights
            Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
