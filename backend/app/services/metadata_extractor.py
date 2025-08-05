from langdetect import detect
import spacy
from keybert import KeyBERT

nlp = spacy.load("en_core_web_sm")
kw_model = KeyBERT()

def extract_metadata(text: str) -> dict:
    language = detect(text)
    doc = nlp(text)
    
    # Named entities
    authors = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    dates = [ent.text for ent in doc.ents if ent.label_ == "DATE"]
    titles = [ent.text for ent in doc.ents if ent.label_ == "WORK_OF_ART"]

    # Topics
    keywords = [kw[0] for kw in kw_model.extract_keywords(text, top_n=5)]

    return {
        "language": language,
        "authors": authors,
        "dates": dates,
        "titles": titles,
        "topics": keywords
    }
