import pandas as pd
import pycountry

FERTILITY_FILE = "data/fertility.csv"
GDP_FILE = "data/gdp.csv"
URBAN_FILE = "data/Urban_Data.csv"
EDUCATION_FILE = "data/education.csv"
POPULATION_FILE = "data/total_population.csv"
PUBLIC_SPENDING_FILE = "data/public_spending.csv"
OUTPUT_FILE = "data/data.csv"

def clean_keys(df):
    df["iso3"] = df["iso3"].astype(str).str.strip().str.upper()
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    return df

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

def clean_public_spending(file_path):
    raw = pd.read_csv(file_path, header=None)

    year_columns = {
        column: int(value)
        for column, value in raw.iloc[3].items()
        if str(value).strip().isdigit()
    }

    spending_columns = {
        "Total": "public_spending_total",
        "Cash": "public_spending_cash",
        "Services": "public_spending_services",
        "Tax-breaks for families": "public_spending_tax_breaks",
    }

    records = []
    for _, row in raw.iloc[4:].iterrows():
        iso3 = str(row.iloc[1]).strip().upper()
        spending_type = str(row.iloc[4]).strip()
        if spending_type == "-":
            spending_type = str(row.iloc[5]).strip()

        value_name = spending_columns.get(spending_type)
        if not value_name or not iso3:
            continue

        for column, year in year_columns.items():
            records.append({
                "iso3": iso3,
                "year": year,
                "metric": value_name,
                "value": row.iloc[column],
            })

    df = pd.DataFrame(records)
    df["value"] = df["value"].replace("..", pd.NA)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    df = df.pivot_table(
        index=["iso3", "year"],
        columns="metric",
        values="value",
        aggfunc="first"
    ).reset_index()

    return clean_keys(df)

fertility = reshape_worldbank(FERTILITY_FILE, "fertility")
gdp = reshape_worldbank(GDP_FILE, "gdp")
urban = reshape_worldbank(URBAN_FILE, "urban")
education = clean_education(EDUCATION_FILE)
population = reshape_worldbank(POPULATION_FILE, "population")
public_spending = clean_public_spending(PUBLIC_SPENDING_FILE)

valid_iso3 = {c.alpha_3 for c in pycountry.countries}

def filter_countries(df):
    return df[df["iso3"].isin(valid_iso3)]

fertility = filter_countries(fertility)
gdp = filter_countries(gdp)
urban = filter_countries(urban)
education = filter_countries(education)
population = filter_countries(population)

keys = ["country", "iso3", "year"]

df = fertility.merge(gdp, on=keys, how="outer") \
              .merge(urban, on=keys, how="outer") \
              .merge(education, on=keys, how="outer") \
              .merge(population, on=keys, how="outer")

df = df.merge(public_spending, on=["iso3", "year"], how="left")

df = df.dropna(subset=["country", "iso3", "year"])

df = df[df["year"] >= 1990]
df = df[df["year"] < 2025]

print("\nFINAL SHAPE:", df.shape)
print("Countries:", df["country"].nunique())
print(df.head())

df.to_csv(OUTPUT_FILE, index=False)

print(f"\nSaved cleaned dataset → {OUTPUT_FILE}")
