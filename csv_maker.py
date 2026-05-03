import pandas as pd
import pycountry

# -----------------------------
# FILE PATHS
# -----------------------------
FERTILITY_FILE = "data/fertility.csv"
GDP_FILE = "data/gdp.csv"
URBAN_FILE = "data/urban.csv"
EDUCATION_FILE = "data/education.csv"

OUTPUT_FILE = "data/data.csv"


# -----------------------------
# CLEAN ISO + YEAR HELPERS
# -----------------------------
def clean_keys(df):
    df["iso3"] = df["iso3"].astype(str).str.strip().str.upper()
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    return df


# -----------------------------
# WORLD BANK WIDE FORMAT HANDLER
# -----------------------------
def reshape_worldbank(file_path, value_name):
    df = pd.read_csv(file_path, skiprows=4)
    df.columns = df.columns.str.strip()

    df = df.drop(columns=["Indicator Name", "Indicator Code"])

    df = df.melt(
        id_vars=["Country Name", "Country Code"],
        var_name="year",
        value_name=value_name
    )

    df = df.rename(columns={
        "Country Name": "country",
        "Country Code": "iso3"
    })

    df = clean_keys(df)
    df[value_name] = pd.to_numeric(df[value_name], errors="coerce")

    return df


# -----------------------------
# EDUCATION CLEANING
# -----------------------------
def clean_education(file_path):
    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip()

    print("\nRAW EDUCATION SHAPE:", df.shape)

    if "Disaggregation" in df.columns:
        df["Disaggregation"] = df["Disaggregation"].astype(str).str.strip().str.lower()
        df = df[df["Disaggregation"] == "female"]

    df = df[[
        "Country Name",
        "Country Code",
        "Year",
        "Value"
    ]]

    df = df.rename(columns={
        "Country Name": "country",
        "Country Code": "iso3",
        "Year": "year",
        "Value": "education"
    })

    df = clean_keys(df)
    df["education"] = pd.to_numeric(df["education"], errors="coerce")

    # aggregate duplicates safely
    df = df.groupby(["country", "iso3", "year"], as_index=False)["education"].mean()

    return df


# -----------------------------
# LOAD DATASETS
# -----------------------------
fertility = reshape_worldbank(FERTILITY_FILE, "fertility")
gdp = reshape_worldbank(GDP_FILE, "gdp")
urban = reshape_worldbank(URBAN_FILE, "urban")
education = clean_education(EDUCATION_FILE)


# -----------------------------
# ALIGN COUNTRIES (optional filter)
# -----------------------------
valid_iso3 = {c.alpha_3 for c in pycountry.countries}

def filter_countries(df):
    return df[df["iso3"].isin(valid_iso3)]

fertility = filter_countries(fertility)
gdp = filter_countries(gdp)
urban = filter_countries(urban)
education = filter_countries(education)


# -----------------------------
# 🔥 FIXED MERGE LOGIC (IMPORTANT CHANGE)
# -----------------------------
keys = ["country", "iso3", "year"]

df = fertility.merge(gdp, on=keys, how="outer") \
              .merge(urban, on=keys, how="outer") \
              .merge(education, on=keys, how="outer")


# -----------------------------
# CLEANING (SAFE VERSION)
# -----------------------------

# keep structure, not completeness
df = df.dropna(subset=["country", "iso3", "year"])

# optional: ensure year validity
df = df[df["year"] >= 1990]
df = df[df["year"] < 2025]

# DO NOT drop NaNs for variables
# (this is what caused your D3 issue before)


# -----------------------------
# DEBUG OUTPUT
# -----------------------------
print("\nFINAL SHAPE:", df.shape)
print("Countries:", df["country"].nunique())
print(df.head())


# -----------------------------
# SAVE FOR D3
# -----------------------------
df.to_csv(OUTPUT_FILE, index=False)

print(f"\n✅ Saved cleaned dataset → {OUTPUT_FILE}")