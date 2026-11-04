import React, { useEffect, useState, useRef } from "react";
import About from "./components/about";
import Experiance from "./components/experiance";
import ProjectsPage from "./components/projects";
import Footer from "./components/footer";
import Contact from "./components/contact";
import IconMarquee from "./components/skills";
import Hero from "./components/hero";

function App() {
  const spotlightRef = useRef(null); // Updated directly on mouse move to avoid re-rendering
  const [activeSection, setActiveSection] = useState("");
  const sections = useRef([]);
  const profileRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null); // Ref for the dropdown menu
  const menuButtonRef = useRef(null); // Ref for the menu button

  const toggleMenu = () => {
    setIsMenuOpen((prevState) => !prevState);
  };

  const handleClickOutside = (event) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target) &&
      !menuButtonRef.current.contains(event.target)
    ) {
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.background = `radial-gradient(500px at ${event.clientX}px ${event.clientY}px, rgba(29, 78, 216, 0.15), transparent 80%)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.6,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(
      observerCallback,
      observerOptions
    );

    const currentSections = sections.current;
    currentSections.forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    // The profile (hero) is taller than the other sections, so it is marked active
    // once 30% of it is in view instead of 60%.
    const profileObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          setActiveSection(entry.target.id);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.3 }
    );
    const profileSection = profileRef.current;
    if (profileSection) profileObserver.observe(profileSection);

    return () => {
      profileObserver.disconnect();
      currentSections.forEach((section) => {
        if (section) {
          observer.unobserve(section);
        }
      });
    };
  }, []);

  const handleNavClick = (id) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  const menuItems = [
    { id: "profile", label: "Profile" },
    { id: "/", label: "About" },
    { id: "experience", label: "Experience" },
    { id: "skills", label: "Tech Stack & Skills" },
    { id: "projects", label: "Projects" },
    { id: "contact", label: "Contact" },
  ];

  return (
    <div className="bg-slate-900 leading-relaxed text-slate-400 antialiased selection:bg-teal-300 selection:text-teal-900 lg:w-screen lg:h-screen sm:h-full">
      <div className="relative lg:w-full sm:w-screen h-full">
        <div
          ref={spotlightRef}
          className="absolute inset-0 z-0 transition duration-300"
        ></div>
        {/* Mobile Header */}
        <div className="w-full bg-slate-900 border-b-2 border-spacing-1 border-slate-500 lg:hidden fixed top-0 py-2 px-6 z-40">
          <button
            className="text-slate-600 flex justify-between w-full"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
            ref={menuButtonRef}
          >
            <h2 className="text-lg font-medium tracking-tight text-slate-200 sm:text-xl">{menuItems.find((item) => item.id === activeSection)?.label || "Jayakumar"}</h2>            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        {/* Dropdown Menu for Small Screens */}
        {isMenuOpen && (
          <nav ref={menuRef} className="lg:hidden fixed top-10 right-0 w-full bg-slate-900 shadow-md z-40">
            <ul className="flex flex-col mt-2">
              {menuItems.map((item) => (
                <li key={item.id} className="border-b border-gray-200">
                  <button
                    className={`group flex items-center py-3 px-4 w-full text-left ${activeSection === item.id ? "active" : ""}`}
                    onClick={() => {
                      handleNavClick(item.id);
                      setIsMenuOpen(false);
                    }}
                  >
                    <span
                      className={`nav-indicator mr-4 h-px transition-all ${activeSection === item.id ? "w-8 bg-slate-200" : "bg-slate-600 w-4"
                        }`}
                    ></span>
                    <span
                      className={`nav-text text-xs font-bold uppercase tracking-widest transition-all ${activeSection === item.id ? "text-slate-200" : "text-slate-500"
                        }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="relative z-10 mx-auto max-w-screen-xl px-6 py-12 font-sans md:px-12 md:py-20 lg:px-20 lg:py-0 h-full">
          <div className="lg:flex lg:justify-between lg:gap-2 h-full lg:py-8">
            <header className="lg:sticky lg:top-0 lg:flex-col sm:flex-row flex-row lg:justify-between lg:w-5/12 md:w-full sm:w-full h-full lg:py-10 sm:h-auto">
              <div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-slate-200 sm:text-5xl">
                    <a href="/">Jayakumar</a>
                  </h1>
                  <h2 className="mt-3 text-lg font-medium tracking-tight text-slate-200 sm:text-xl">
                    UI/UX Designer
                  </h2>
                  <p className="lg:mt-4 mt-3 max-w-xs leading-normal">
                    I build pixel-perfect, engaging, and accessible digital
                    experiences.
                  </p>
                </div>
                {/* Navigation Menu for Large Screens */}
                <nav
                  className="nav hidden lg:block"
                  aria-label="In-page jump links"
                >
                  <ul className="mt-16 w-max">
                    {menuItems.map((item) => (
                      <li key={item.id} className="relative group">
                        <button
                          className={`group flex items-center py-3 ${activeSection === item.id ? "active" : ""
                            }`}
                          onClick={() => handleNavClick(item.id)}
                        >
                          <span
                            className={`nav-indicator mr-4 h-px w-8 transition-all ${activeSection === item.id
                              ? "lg:w-14 bg-slate-200"
                              : "bg-slate-600"
                              } group-hover:w-14 group-hover:bg-slate-200`}
                          ></span>
                          <span
                            className={`nav-text text-xs font-bold uppercase tracking-widest transition-all ${activeSection === item.id
                              ? "text-slate-200"
                              : "text-slate-500"
                              } group-hover:text-slate-200`}
                          >
                            {item.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
              <div>
                <ul className="ml-1 lg:mt-8 md:mt-4 mt-4 flex items-center">
                  <li className="mr-5 text-xs shrink-0">
                    <a
                      className="block hover:text-slate-200"
                      href="https://github.com/JayaKumar-FullStackDeveloper"
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="LinkedIn (opens in a new tab)"
                      title="LinkedIn"
                    >
                      <span className="sr-only">Github</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-8 w-8"
                        aria-hidden="true"
                      >
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                      </svg>
                    </a>
                  </li>
                  <li className="mr-5 text-xs shrink-0">
                    <a
                      className="block hover:text-slate-200"
                      href="https://www.linkedin.com/in/Jayakumar-FullStackDeveloper/"
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="LinkedIn (opens in a new tab)"
                      title="LinkedIn"
                    >
                      <span className="sr-only">LinkedIn</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-9 w-9"
                        aria-hidden="true"
                      >
                        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
                      </svg>
                    </a>
                  </li>
                  <li className="mr-5 text-xs shrink-0">
                    <a
                      className="block hover:text-slate-200"
                      href="https://www.figma.com/@Jayakumar_JK"
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Figma (opens in a new tab)"
                      title="Figma"
                    >
                      <span className="sr-only">Figma</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 48 48"
                        className="h-9 w-9"
                        id="Figma"
                        aria-hidden="true"
                      >
                        <path d="M0 24C0 10.7452 10.7452 0 24 0C37.2548 0 48 10.7452 48 24C48 37.2548 37.2548 48 24 48C10.7452 48 0 37.2548 0 24ZM19.2 38.4C21.851 38.4 24 36.251 24 33.6V28.8H19.2C16.549 28.8 14.4 30.949 14.4 33.6C14.4 36.251 16.549 38.4 19.2 38.4ZM14.4 24C14.4 26.651 16.549 28.8 19.2 28.8H24V19.2H19.2C16.549 19.2 14.4 21.349 14.4 24ZM14.4 14.4C14.4 17.051 16.549 19.2 19.2 19.2H24V9.6H19.2C16.549 9.6 14.4 11.749 14.4 14.4ZM24 9.6V19.2H28.8C31.451 19.2 33.6 17.051 33.6 14.4C33.6 11.749 31.451 9.6 28.8 9.6H24ZM33.6 24C33.6 21.349 31.451 19.2 28.8 19.2C26.149 19.2 24 21.349 24 24C24 26.651 26.149 28.8 28.8 28.8C31.451 28.8 33.6 26.651 33.6 24Z"></path>
                      </svg>
                    </a>
                  </li>
                  <li className="mr-5 text-xs shrink-0">
                    <a
                      className="block hover:text-slate-200"
                      href="https://www.behance.net/Jayakumar_JK"
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Behance (opens in a new tab)"
                      title="Behance"
                    >
                      <span className="sr-only">Behance</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 333333 333333"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        className="h-9 w-9"
                        aria-hidden="true"
                      >
                        <path d="M166667 0c92048 0 166667 74619 166667 166667s-74619 166667-166667 166667S0 258715 0 166667 74619 0 166667 0zm-35027 114428c4916 0 9342 427 13375 1305 4044 843 7461 2281 10360 4232 2865 1958 5075 4564 6709 7815 1564 3220 2345 7260 2345 12046 0 5180-1166 9474-3521 12933-2376 3450-5826 6254-10456 8472 6315 1822 10976 5014 14102 9544 3124 4564 4626 10034 4626 16475 0 5211-1012 9670-2989 13449-2019 3813-4755 6903-8106 9285-3386 2407-7294 4167-11662 5306-4336 1133-8796 1726-13407 1726l-49734 1V114437l48363 3-6-13v1zm60464 8276h41592v10132l-41592-3v-10132 3zm9243 76465c3066 2989 7461 4491 13197 4491 4103 0 7691-1047 10649-3130 2958-2084 4755-4290 5441-6574l17971 3c-2900 8950-7263 15308-13252 19152-5901 3844-13121 5796-21498 5796-5869 0-11107-952-15831-2807-4722-1887-8661-4521-11985-7983-3222-3450-5761-7553-7556-12376-1761-4782-2665-10098-2665-15828 0-5568 917-10748 2730-15536 1856-4826 4398-8953 7783-12444 3382-3487 7356-6254 12049-8272 4660-2022 9806-3035 15505-3035 6281 0 11785 1210 16509 3681 4691 2438 8565 5731 11594 9837 3034 4109 5179 8826 6515 14099 1335 5272 1791 10775 1425 16548l-53633-2c0 5826 1958 11403 5044 14358l6 22v-1zm23418-39010c-2407-2668-6546-4136-11526-4136-3263 0-5958 550-8106 1658-2115 1102-3844 2469-5179 4103-1302 1628-2219 3389-2728 5238-520 1791-843 3450-951 4888l33224-3c-489-5207-2281-9052-4721-11753l-12 6-1-1zm-96065-4306c4002 0 7322-951 9926-2869 2604-1887 3844-5014 3844-9316 0-2372-424-4367-1272-5900-874-1530-2022-2739-3483-3582-1437-875-3059-1472-4976-1794-1856-354-3813-517-5795-517h-21100v23967h22864l-6 11h-1zm1238 43671c2222 0 4336-198 6309-659 2019-455 3813-1135 5306-2175 1499-1012 2772-2342 3678-4103 917-1729 1335-3939 1335-6639 0-5272-1502-9055-4460-11338-2957-2253-6898-3355-11781-3355h-24489v28229l24102-2v43z" />
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>
            </header>
            <main
              className="lg:px-6 lg:w-7/12 h-full overflow-y-auto transition duration-300 relative"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <section id="profile" ref={profileRef}>
                <Hero />
              </section>
              <section
                id="/"
                ref={(el) => (sections.current[0] = el)}
                className="mt-4 lg:mt-6"
              >
                <h1 className=" lg:hidden z-40 text-xl font-bold text-teal-300 lg:pb-4 pb-2 mt-6 ">About</h1>
                <About />
              </section>
              <section
                id="experience"
                ref={(el) => (sections.current[1] = el)}
                className="mt-4"
              >
                <h1 className="z-10 text-xl font-bold text-teal-300 pb-2">Experiance</h1>
                <Experiance />
              </section>
              <section
                id="skills"
                ref={(el) => (sections.current[2] = el)}
                className="mt-4"
              >
                <h1 className="z-40 text-xl font-bold text-teal-300 pb-2">Tech Stack & Skills</h1>
                <IconMarquee />
              </section>
              <section
                id="projects"
                ref={(el) => (sections.current[3] = el)}
                className="mt-4 scroll-mt-16 lg:scroll-mt-0"
              >
                <ProjectsPage />
              </section>
              <section
                id="contact"
                ref={(el) => (sections.current[4] = el)}
                className="mt-4"
              >
                <h1 className="z-10 text-xl font-bold text-teal-300 py-2">Contact</h1>
                <Contact />
                <Footer />
              </section>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
