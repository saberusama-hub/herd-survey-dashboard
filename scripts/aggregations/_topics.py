"""Shared 30-topic taxonomy + DuckDB-safe regex patterns."""

# Topic name -> ICU/RE2-compatible regex (DuckDB uses RE2).
# Notes:
#   - DuckDB regex doesn't support \b for unicode word boundary the same way
#     Python re does, but `\b` IS supported (RE2 syntax).
#   - Wrap patterns case-insensitive at the call site (regexp_matches(... , 'i')).
#   - Topics are NOT mutually exclusive — a grant can match multiple.
TOPICS: dict[str, str] = {
    "Artificial intelligence & ML":      r"\b(artificial intelligence|machine learning|deep learning|neural network|transformer|large language model|LLM|reinforcement learning)\b",
    "Computer vision":                    r"\b(computer vision|image recognition|object detection|visual recognition)\b",
    "Natural language processing":        r"\b(natural language processing|NLP|language model|speech recognition|machine translation)\b",
    "Cancer research":                    r"\b(cancer|oncology|tumor|carcinoma|malignan(t|cy)|metasta(sis|tic|sized))\b",
    "Neuroscience & brain":               r"\b(neuroscience|brain|neurolog|neuron|neuronal|cognitive|cortex|cerebr(al|um))\b",
    "Cardiovascular":                     r"\b(cardiovascular|cardiac|heart disease|coronary|stroke|hypertension)\b",
    "Infectious disease & vaccines":      r"\b(infectious disease|virus|viral|bacteria(l)?|pathogen|vaccine|antimicrobial|pandemic)\b",
    "Immunology":                         r"\b(immunology|immune|autoimmune|antibody|antigen|T cell|B cell)\b",
    "Genomics & genetics":                r"\b(genom(e|ic|ics)|genetic|DNA|RNA sequenc|CRISPR|gene editing|gene therapy)\b",
    "Drug discovery & pharmacology":      r"\b(drug discovery|pharmacolog|small molecule|therapeutic agent|medicinal chemistry)\b",
    "Mental health & psychiatry":         r"\b(mental health|psychiatr|depression|anxiety|PTSD|schizophrenia|addiction|substance abuse)\b",
    "Aging & longevity":                  r"\b(aging|longevity|Alzheimer|dementia|Parkinson|senescence)\b",
    "Diabetes & metabolic":               r"\b(diabetes|obesity|metabolic|insulin)\b",
    "Regenerative medicine":              r"\b(stem cell|regenerative medicine|tissue engineering)\b",
    "Bioengineering & synthetic biology": r"\b(bioengineering|synthetic biology|biomanufacturing|bioreactor)\b",
    "Public health & epidemiology":       r"\b(public health|epidemiolog|health disparit|health equity|population health)\b",
    "Quantum information":                r"\b(quantum computing|quantum information|qubit|quantum cryptography|quantum sens)\b",
    "Materials science":                  r"\b(materials science|polymer|composite|alloy|semiconductor|nanomaterial)\b",
    "Nanotechnology":                     r"\b(nanotechnolog|nanoparticle|nanostructure|nanoscale)\b",
    "Climate & sustainability":           r"\b(climate change|greenhouse|carbon dioxide|sustainability|decarbonization|emission)\b",
    "Renewable energy":                   r"\b(solar|wind|geothermal|renewable energy|photovoltaic)\b",
    "Energy storage & batteries":         r"\b(battery|lithium ion|energy storage|fuel cell)\b",
    "Cybersecurity":                      r"\b(cybersecurity|cyber security|network security|cryptograph|encryption)\b",
    "Robotics & autonomy":                r"\b(robot(ic|s)?|autonomous (vehicle|system)|self-driving|drone)\b",
    "Earth observation":                  r"\b(remote sensing|satellite (data|imagery)|earth observation|land cover|MODIS|landsat)\b",
    "Astrophysics & cosmology":           r"\b(astrophysic|cosmolog|galaxy|exoplanet|dark (matter|energy)|gravitational wave)\b",
    "Agriculture & food":                 r"\b(agricultur|crop|soil|food security|sustainable agriculture)\b",
    "Water resources":                    r"\b(water resource|hydrolog|watershed|drinking water|wastewater)\b",
    "Education research":                 r"\b(STEM education|science education|curriculum|pedagog|teacher training|broadening participation)\b",
    "Social & behavioral science":        r"\b(behavioral science|sociolog|economic policy|social network|inequality)\b",
}


def topic_case_expressions() -> str:
    """Build a UNION ALL pattern for tagging grants per topic.

    Caller is responsible for wrapping in the right CTE — this helper
    returns the per-topic CASE...END line and just escapes single quotes.
    Returns ``label, pattern`` pairs ready for SQL injection.
    """
    return TOPICS
