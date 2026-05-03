

const width = 960;
const height = 600;
const introWidth = 960;
const introHeight = 320;
const introMargin = { top: 20, right: 20, bottom: 40, left: 50 };
const introInnerWidth = introWidth - introMargin.left - introMargin.right;
const introInnerHeight = introHeight - introMargin.top - introMargin.bottom;

const introSvg = d3.select("#intro-vis")
  .append("svg")
  .attr("width", introWidth)
  .attr("height", introHeight)
  .attr("viewBox", `0 0 ${introWidth} ${introHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const introChart = introSvg.append("g")
  .attr("transform", `translate(${introMargin.left},${introMargin.top})`);


d3.csv("data/data.csv").then(data => {

      data.forEach(d => {
        d.year = +d.year;
        d.fertility = d.fertility === "" ? null : +d.fertility;
      });

      const yearlyTotals = Array.from(
        d3.rollup(
          data.filter(d => d.fertility != null),
          values => d3.mean(values, d => d.fertility),
          d => d.year
        ),
        ([year, avgFertility]) => ({ year, avgFertility })
      ).sort((a, b) => a.year - b.year);

      const x = d3.scaleLinear()
              .domain(d3.extent(yearlyTotals, d => d.year))
              .range([0, introInnerWidth]); 
      introChart.append("g")
      .attr("transform", "translate(0," + introInnerHeight + ")")
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

      const y = d3.scaleLinear()
      .domain([d3.min(yearlyTotals, function(d) {return d.avgFertility; }), d3.max(yearlyTotals, function(d) { return d.avgFertility; })])
      .range([ introInnerHeight, 0 ]);
      introChart.append("g")
        .call(d3.axisLeft(y));

      introChart.append("path")
        .datum(yearlyTotals)
        .attr("fill", "none")
        .attr("stroke", "steelblue")

        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function(d) { return x(d.year) })
          .y(function(d) { return y(d.avgFertility) })
        ); 
      
        introChart.selectAll("circle")
          .data(yearlyTotals)
          .enter()
          .append("circle")
          .attr("cx", d => x(d.year))
          .attr("cy", d => y(d.avgFertility))
          .attr("r", 3)
          .attr("fill", "black")
          .on("mouseover", function(event, d) {
            tooltip
              .style("opacity", 1)
              .html(`
                <strong>Year:</strong> ${d.year}<br/>
                <strong>Average fertility:</strong> ${d.avgFertility.toFixed(2)}
              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY + 10}px`);
          })
          .on("mouseout", function() {
            tooltip.style("opacity", 0);
          });
              
      }
)

//WORLD MAP START

const fmt = (v, type) => {
  if (v === "" || v == null || isNaN(v)) return "No data";

  if (type === "gdp" || type === "urban") {
    return Math.round(v);
  }

  return v;
};

const tooltip = d3.select("#tooltip");

Promise.all([
  d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
  d3.csv("data/data.csv")
]).then(([world, data]) => {

  data.forEach(d => {
    d.year = +d.year;
    d.iso3 = (d.iso3 || "").trim().toUpperCase();

    d.fertility = d.fertility === "" ? null : +d.fertility;
    d.gdp = d.gdp === "" ? null : +d.gdp;
    d.urban = d.urban === "" ? null : +d.urban;
    d.education = d.education === "" ? null : +d.education;
  });

  const dataByIsoYear = d3.group(
    data,
    d => d.iso3,
    d => d.year
  );

  const fertilityExtent = d3.extent(
    data.filter(d => d.fertility != null),
    d => d.fertility
  );

  const colorScale = d3.scaleSequential()
    .domain(fertilityExtent)
    .interpolator(d3.interpolatePlasma);

  const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("border", "1px solid black");
    

  const projection = d3.geoNaturalEarth1()
    .scale(160)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  const countries = world.features;

  const g = svg.append("g");

  const paths = g.selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5);

  const years = Array.from(new Set(data.map(d => d.year)))
    .sort((a, b) => a - b);

  const slider = d3.select("#yearSlider")
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .property("value", d3.max(years));

  const yearLabel = d3.select("#yearLabel");

  function update(year) {

    year = +year;
    yearLabel.text(year);

    paths.transition()
      .duration(300)
      .attr("fill", d => {

        const iso = (d.id || "")
          .toString()
          .trim()
          .toUpperCase();

        const row = dataByIsoYear.get(iso)?.get(year)?.[0];

        return row?.fertility != null
          ? colorScale(row.fertility)
          : "#ccc";
      });
  }

  update(slider.property("value"));

  slider.on("input", function () {
    update(this.value);
  });

  paths
    .on("mouseover", function(event, d) {

      const year = +slider.property("value");
      const iso = (d.id || "").toString().trim().toUpperCase();

      const row = dataByIsoYear.get(iso)?.get(year)?.[0];

      d3.select(this)
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${fmt(d.properties.name)}</strong><br/>
          Fertility: ${fmt(row?.fertility)}<br/>
          GDP: ${fmt(row?.gdp, "gdp")}<br/>
          Urban: ${fmt(row?.urban, "urban")}<br/>
          Education: ${fmt(row?.education)}
        `);
    })

    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })

    .on("mouseout", function() {
      d3.select(this)
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5);

      tooltip.style("opacity", 0);
    });

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

});

//WORLD MAP END
