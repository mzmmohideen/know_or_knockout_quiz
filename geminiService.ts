
import { GoogleGenAI, Type } from "@google/genai";
import { Genre, Question, QuestionType } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const PREDEFINED_QUIZ: Record<string, any[]> = {
  [Genre.Cuisine]: [
    { type: 'Visual Decode', question: "A folded tortilla filled with seasoned meat, onions, and cilantro.", answer: "Tacos" },
    { type: 'Word Scramble', question: "Y-A-N-I-R-I-B", answer: "BIRYANI" },
    { type: 'Current Pulse', question: "Which Indian state is famous for the dish 'Dhokla'?", answer: "Gujarat" },
    { type: 'Odd One Out', question: "Masala Dosa, Paneer Tikka, Vada Pav, iPhone", answer: "iPhone" },
    { type: 'Rapid Recall', question: "What is the main ingredient used to make 'Dal'?", answer: "Pulses / Lentils" }
  ],
  [Genre.Mystery]: [
    { type: 'Visual Decode', question: "A silhouetted figure holding a magnifying glass near a trail of footprints.", answer: "Detective / Investigation" },
    { type: 'Word Scramble', question: "Y-E-R-T-S-Y-M", answer: "MYSTERY" },
    { type: 'Current Pulse', question: "Which fictional Indian detective was created by Satyajit Ray?", answer: "Feluda" },
    { type: 'Odd One Out', question: "Sherlock Holmes, Byomkesh Bakshi, Hercule Poirot, Mickey Mouse", answer: "Mickey Mouse" },
    { type: 'Rapid Recall', question: "What is the famous address of detective Sherlock Holmes?", answer: "221B Baker Street" }
  ],
  [Genre.IndianCinema]: [
    { type: 'Visual Decode', question: "A group of villagers playing a high-stakes cricket match against British officers.", answer: "Lagaan" },
    { type: 'Word Scramble', question: "H-O-L-A-Y-S", answer: "SHOLAY" },
    { type: 'Current Pulse', question: "2025 movie starring Vikrant Massey about the UPSC journey?", answer: "12th Fail" },
    { type: 'Odd One Out', question: "Rajinikanth, Amitabh Bachchan, Shah Rukh Khan, Tom Cruise", answer: "Tom Cruise" },
    { type: 'Rapid Recall', question: "Who is known as the 'Father of Indian Cinema'?", answer: "Dadasaheb Phalke" }
  ],
  [Genre.FamousPersonalities]: [
    { type: 'Visual Decode', question: "An Indian warrior queen in royal attire holding a sword, representing the resistance against colonial rule.", answer: "Velu Nachiyar" },
    { type: 'Word Scramble', question: "N-R-A-A-T-T-T-A-A", answer: "RATAN TATA" },
    { type: 'Current Pulse', question: "Who is the current Chief Justice of India (Feb 2026)?", answer: "Justice Surya Kant" },
    { type: 'Odd One Out', question: "Elon Musk, Jeff Bezos, Mark Zuckerberg, Taylor Swift", answer: "Taylor Swift" },
    { type: 'Rapid Recall', question: "Who is the 'Iron Man of India'?", answer: "Sardar Vallabhbhai Patel" }
  ],
  [Genre.Science]: [
    { type: 'Visual Decode', question: "Logo of an Indian space agency featuring a rocket and a blue globe.", answer: "ISRO / Chandrayaan" },
    { type: 'Word Scramble', question: "T-E-W-A-R", answer: "WATER" },
    { type: 'Current Pulse', question: "What is the name of India's first solar mission?", answer: "Aditya-L1" },
    { type: 'Odd One Out', question: "Newton, Einstein, C.V. Raman, Shakespeare", answer: "Shakespeare" },
    { type: 'Rapid Recall', question: "Which gas do humans breathe in to stay alive?", answer: "Oxygen" }
  ],
  [Genre.Technology]: [
    { type: 'Visual Decode', question: "A generic interface showing a 'Scan & Pay' option with a square pixel pattern.", answer: "UPI" },
    { type: 'Word Scramble', question: "O-N-T-Y-H-P", answer: "PYTHON" },
    { type: 'Current Pulse', question: "Parent company of Google?", answer: "Alphabet" },
    { type: 'Odd One Out', question: "Keyboard, Mouse, Monitor, Coffee", answer: "Coffee" },
    { type: 'Rapid Recall', question: "Who is the CEO of Google?", answer: "Sundar Pichai" }
  ],
  [Genre.History]: [
    { type: 'Visual Decode', question: "A massive red sandstone fortification in Delhi, built by Shah Jahan.", answer: "Red Fort" },
    { type: 'Word Scramble', question: "A-D-I-Z-A", answer: "AZADI" },
    { type: 'Current Pulse', question: "First woman Prime Minister of India?", answer: "Indira Gandhi" },
    { type: 'Odd One Out', question: "Ashoka, Akbar, Shivaji, Harry Potter", answer: "Harry Potter" },
    { type: 'Rapid Recall', question: "In which year did India get Independence?", answer: "1947" }
  ],
  [Genre.Geography]: [
    { type: 'Visual Decode', question: "An ivory-white marble mausoleum on the south bank of the Yamuna river.", answer: "Agra / Taj Mahal" },
    { type: 'Word Scramble', question: "I-N-D-I-A", answer: "INDIA" },
    { type: 'Current Pulse', question: "Longest river in India?", answer: "Ganga" },
    { type: 'Odd One Out', question: "Sahara, Gobi, Thar, Himalaya", answer: "Himalaya" },
    { type: 'Rapid Recall', question: "What is the capital of India?", answer: "New Delhi" }
  ],
  [Genre.LogicReasoning]: [
    { type: 'Visual Decode', question: "The result of 5 squared.", answer: "25" },
    { type: 'Word Scramble', question: "I-C-G-O-L", answer: "LOGIC" },
    { type: 'Current Pulse', question: "If a doctor gives you 3 pills and says take one every 30 mins, how long do they last?", answer: "1 Hour" },
    { type: 'Odd One Out', question: "Square, Circle, Triangle, Pencil", answer: "Pencil" },
    { type: 'Rapid Recall', question: "What is 10 + 20 x 0?", answer: "10" }
  ],
  [Genre.GeneralKnowledge]: [
    { type: 'Visual Decode', question: "Symbol of four Asiatic lions standing back to back, mounted on an abacus.", answer: "Ashoka Pillar" },
    { type: 'Word Scramble', question: "P-E-A-C-O-C-K", answer: "PEACOCK" },
    { type: 'Current Pulse', question: "Which city is known as the 'Pink City'?", answer: "Jaipur" },
    { type: 'Odd One Out', question: "Lotus, Tiger, Banyan Tree, Pizza", answer: "Pizza" },
    { type: 'Rapid Recall', question: "How many states are there in India?", answer: "28" }
  ],
  [Genre.BrandsLogos]: [
    { type: 'Visual Decode', question: "A logo featuring a stylized blue circle with a white vertical line inside, often seen on salt and trucks.", answer: "Tata" },
    { type: 'Word Scramble', question: "U-M-A-L", answer: "AMUL" },
    { type: 'Current Pulse', question: "Which brand has the tagline 'Just Do It'?", answer: "Nike" },
    { type: 'Odd One Out', question: "Apple, Samsung, Vivo, Maggi", answer: "Maggi" },
    { type: 'Rapid Recall', question: "Which Indian car brand owns Jaguar Land Rover?", answer: "Tata Motors" }
  ],
  [Genre.Archaeology]: [
    { type: 'Visual Decode', question: "A 13th-century CE temple shaped like a giant chariot with stone wheels.", answer: "Konark Sun Temple" },
    { type: 'Word Scramble', question: "M-A-P-P-I-H", answer: "HAMPI" },
    { type: 'Current Pulse', question: "Ancient civilization famous for the 'Great Bath'?", answer: "Indus Valley" },
    { type: 'Odd One Out', question: "Hampi, Ajanta, Ellora, Burj Khalifa", answer: "Burj Khalifa" },
    { type: 'Rapid Recall', question: "Script used by Emperor Ashoka?", answer: "Brahmi" }
  ],
  [Genre.Countries]: [
    { type: 'Visual Decode', question: "A country-continent located in the southern hemisphere, famous for the Opera House.", answer: "Australia" },
    { type: 'Word Scramble', question: "A-S-I-A", answer: "ASIA" },
    { type: 'Current Pulse', question: "Which is the smallest continent?", answer: "Australia" },
    { type: 'Odd One Out', question: "India, Japan, China, Mars", answer: "Mars" },
    { type: 'Rapid Recall', question: "Most populous country as of 2026?", answer: "India" }
  ],
  [Genre.CurrentAffairs]: [
    { type: 'Visual Decode', question: "A triangular-shaped building in New Delhi designed for legislative assembly.", answer: "New Parliament" },
    { type: 'Word Scramble', question: "V-O-T-E", answer: "VOTE" },
    { type: 'Current Pulse', question: "Who is the current President of India?", answer: "Droupadi Murmu" },
    { type: 'Odd One Out', question: "G20, BRICS, NATO, Netflix", answer: "Netflix" },
    { type: 'Rapid Recall', question: "In which city is the Ram Mandir located?", answer: "Ayodhya" }
  ],
  [Genre.Sports]: [
    { type: 'Visual Decode', question: "A team wearing sky blue jerseys with BCCI logo, playing with a bat and ball.", answer: "Indian Cricket Team" },
    { type: 'Word Scramble', question: "D-I-K-B-A-A-D", answer: "KABADDI" },
    { type: 'Current Pulse', question: "Golden Boy of Indian Athletics (Javelin)?", answer: "Neeraj Chopra" },
    { type: 'Odd One Out', question: "Cricket, Hockey, Football, Ludo", answer: "Ludo" },
    { type: 'Rapid Recall', question: "How many players are on a Cricket field from one team?", answer: "11" }
  ],
  [Genre.QuantitativeAptitude]: [
    { type: 'Visual Decode', question: "A basic addition visual: three fruits combined with two more fruits.", answer: "5" },
    { type: 'Word Scramble', question: "M-A-T-H-S", answer: "MATHS" },
    { type: 'Current Pulse', question: "If you spend Rs 45 from Rs 100, what is left?", answer: "Rs 55" },
    { type: 'Odd One Out', question: "2, 4, 6, 7, 8", answer: "7" },
    { type: 'Rapid Recall', question: "Minutes in half an hour?", answer: "30" }
  ]
};

export const fetchAllQuestionsForGenre = async (genre: Genre, usedQuestions: Set<string>): Promise<Question[]> => {
  const pre = PREDEFINED_QUIZ[genre];
  if (pre) {
    return pre.map(q => ({
      text: q.question,
      answer: q.answer,
      genre: genre,
      type: q.type as QuestionType,
      imageUrl: q.imageUrl
    }));
  }

  const prompt = `Generate exactly 5 competitive quiz questions for "${genre}".
  Required types: Visual Decode, Word Scramble, Current Pulse (2025+ events), Odd One Out, Rapid Recall.
  The "Visual Decode" question should be a description of a specific famous object/place/logo.
  Return only JSON format.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
          },
          required: ["type", "question", "answer"],
        }
      },
    },
  });

  const rawQuestions = JSON.parse(response.text || '[]');
  return rawQuestions.map((q: any) => ({
    text: q.question,
    answer: q.answer,
    genre: genre,
    type: q.type as QuestionType,
    imageUrl: undefined
  }));
};

export const fetchImageForQuestion = async (questionText: string): Promise<string | undefined> => {
  return undefined;
};
