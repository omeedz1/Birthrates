
const margin = { top: 20, right: 20, bottom: 20, left: 30 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select('#vis')
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

window.addEventListener("load", init);

function formatData(data) {
    return data.map(d => ({
        stateFullName: d.state,
        state: d.state_po,           // two-letter abbreviation
        year: +d.year,
        party: d.party_detailed,
        candidatePerc: +d.candidatevotes / +d.totalvotes // compute vote share
    }));
}

async function init() {
    const gridMap = await d3.json('data/us-grid-map.json');
    const electionData = await d3.csv('data/1976-2020-president.csv');
    
    const formattedElectionData = formatData(electionData);
    firstYear = d3.min(formattedElectionData, d => d.year)
    lastYear = d3.max(formattedElectionData, d => d.year)
    updateVis(gridMap, formattedElectionData)
}

function updateVis(map, electionData) {

    const xScale = d3.scaleLinear()
    .domain([0, 12]) // slightly larger, you can try [0, 11] to see what happens!
    .range([0, width]);

    const unit = xScale(1) - xScale(0); // width of one cell in pixels
    
    const xOffset = (width - 12 * unit) / 2;
    const yOffset = (height - 8 * unit) / 2;
    svg.attr('transform', `translate(${margin.left + xOffset}, ${margin.top + yOffset})`);

    svg.selectAll('.state')
    .data(map)
    .join(enter =>
        enter.append('rect')
            .attr('class', 'state')
            .attr('x', d => d.x * unit)
            .attr('y', d => d.y * unit)
            .attr('width', unit * 0.9) // leave some space between states
            .attr('height', unit * 0.9) // leave some space between states
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#eeeeee')
            .attr('id', d => 'state-' + d.key)

            .on('mouseover', function(event, d) {
                d3.select(this).attr('stroke', '#999').attr('stroke-width', 2);
                d3.select('#tooltip')
                    .style('display', 'block')
                    .html(`<strong>${d.name}</strong> (${d.key})`)
                    .style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY - 20) + 'px');
            })
            .on('mousemove', function(event) {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY - 20) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', '#eeeeee').attr('stroke-width', 1);
                d3.select('#tooltip').style('display', 'none');
            })
    );

    svg.selectAll('.state')
    .each(function(d) {
        const localXScale = d3.scaleLinear()
            .domain([firstYear, lastYear])
            .range([d.x * unit, (d.x + 0.9) * unit]);  // left to right edge of cell

        const localYScale = d3.scaleLinear()
            .domain([0, 1])
            .range([(d.y + 0.9) * unit, d.y * unit]);   // bottom to top of cell (inverted!)

        const stateElectionData = electionData.filter(e => e.state === d.key);
        const line = d3.line()
            .x(d => localXScale(d.year))          // map year → pixel x within the cell
            .y(d => localYScale(d.candidatePerc)); // map vote share → pixel y within the cell

        const parties = ["REPUBLICAN", "DEMOCRAT"];
        const partyColor = {"REPUBLICAN": "red", "DEMOCRAT": "blue"}

        parties.forEach(party => {
            const partyData = stateElectionData.filter(d => d.party === party);
            svg.append("path")
                .attr("d", line(partyData)) //partyData into line generating, data attribute of path
                .attr("stroke", partyColor[party]) // black color for now
                .attr("stroke-width", "1px")
                .attr("fill", "none");  // lines have no fill — only the stroke matters

        });

        if (d.key === 'AK') {
            const xAxis = d3.axisBottom(localXScale)
                .ticks(3)
                .tickFormat(d3.format('d'))
                .tickSize(3);

            const yAxis = d3.axisLeft(localYScale)
                .ticks(3)
                .tickFormat(d3.format('.0%'))
                .tickSize(3);

            svg.append('g')
                .attr('class', 'axis-state x-axis')
                .attr('transform', `translate(0, ${(d.y + 0.9) * unit})`)
                .call(xAxis)
                .selectAll('text')
                .attr('transform', 'rotate(-60)')
                .attr('text-anchor', 'end')
                .attr('dy', '0.4em')
                .attr('dx', '-0.4em');

            svg.append('g')
                .attr('class', 'axis-state y-axis')
                .attr('transform', `translate(${d.x * unit}, 0)`)
                .call(yAxis);
        }
    });

    svg.selectAll('.state-label')
    .data(map)
    .join(enter =>
        enter.append('text')
            .attr('class', 'state-label')
            .attr('x', d => d.x * unit + unit * 0.45)  // horizontal center of cell
            .attr('y', d => d.y * unit + unit * 0.22)  // near the top
            .attr('text-anchor', 'middle')
            .text(d => d.key)
    );

}
