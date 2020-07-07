(function () {
    var Ext = window.Ext4 || window.Ext;
    var gApp = null;
    var svg = null, x = null, xz = null, yMax = null, y1Max = null, y01z = null, y = null, z = null;

Ext.define('typesToChoose', {
    extend: 'Ext.data.Model',
    fields: [
        {name: 'name',    type: 'string' },
        {name: 'value',    type: 'string' }
    ],

    // To help the rallycombobox, we need to provide some equivalents
    getNonCollectionFields: function() {
        return this.fields;
    }
});

Ext.define('Nik.Apps.SprintChangeChart', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    itemId: 'rallyApp',
    isFullPageApp: true,
    fieldVals: ['Same', 'Added', 'Removed'],
    initComponent: function() {
        gApp = this;
        this.callParent(arguments);
        this.addCls('rally-app');

            if (this.isFullPageApp) {
                this.addCls('full-page-app');
            }

            this.subscribe(this, Rally.app.Message.timeboxScopeChange, this.onTimeboxScopeChange, this);
    },

    margin: ({top: 20, right: 0, bottom: 80, left: 20}),
    config: {
        defaultSettings: {
            artefact: 'HierarchicalRequirement',
            usePlanEstimate: true
        }
    },
    items: [
        { 
            xtype: 'container',
            itemId: 'headerBox',
            layout: 'hbox',
            
        },
        {
            xtype: 'container',
            itemId: 'rootSurface',
            margin: '5 15 5 5',
            layout: 'auto',
            title: 'Loading...',
            autoEl: { 
                tag: 'svg'
            },
            visible: false 
        }
    ],

    _getDateArray: function(iteration) {
        var elapsed = Math.round(Ext.Date.getElapsed(iteration.get('StartDate'),iteration.get('EndDate'))/
            (1000*60*60*24));
        var ret = [];
        for ( var i = 0; i < elapsed; i++ ) {
            ret.push( 
                {
                    start: Ext.Date.add(new Date(iteration.get('StartDate')), Ext.Date.DAY, i),
                    end: Ext.Date.add(new Date(iteration.get('StartDate')), Ext.Date.DAY, i+1),
//                    end:  Ext.Date.add(iteration.get('StartDate', i+1, Ext.Date.DAY))
                }
            );
        }
        return ret;
    },

    getSettingsFields: function() {

        return [
        
            {
                xtype: 'rallycombobox',
                name: 'artefact',
                fieldLabel: ' ',
                margin: '0 0 15 50',
                afterLabelTpl: 'The Rally model added to Iteration<br/><span style="color:#999999;">eg. <i>UserStory</i></span>',
                labelStyle : "width:200px;",
                // stateful: true,
                // stateId: this.getContext().getScopedStateId('artefactcombo'),
                minWidth: 200,
                storeType: 'Ext.data.Store',
                store: this.store,
                displayField: 'name',
                valueField: 'value',
                labelAlign: 'left',
                bubbleEvents: ['select', 'ready', 'typeSelectedEvent'],
                readyEvent: 'ready',
                listeners: {
                    ready: function() {
                        if (this.getRecord()!==false) {
                            console.log("ready, saving type ",this.getRecord());
                            gApp.artefactType = this.getRecord().data && this.getRecord().data.value;
                        }
                        console.log('artefact type is: ', gApp.artefactType);
                        
                        this.fireEvent('typeSelectedEvent', this);
                    },
                    select: function() {
                        console.log("select, saving type ",this.getRecord());
                        gApp.artefactType = this.getRecord().data.value;
                        this.fireEvent('typeSelectedEvent', this);
                    }
                },
            },            
            {
                name: 'usePlanEstimate',
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Use PlanEstimate'
            }
        ];
    },
    _setXAxis: function(g) {
        gApp.xAxis = g
            .attr("transform", `translate(0,${svg.attr('height') - gApp.margin.bottom})`)
            .call(
                d3.axisBottom(x)
                    .tickSizeOuter(0)
                    .tickFormat((datestring) => Ext.Date.format(datestring, 'Y/M/j'))
                );
    },

    _setYAxis: function(g) {
        var ticks = y.ticks(1);
        var tickF = y.tickFormat(1, "s");
        ticks.map(tickF);
        var svg = d3.select('svg');
        gApp.yAxis = g
          .attr("transform", `translate(${gApp.margin.left},0)`)
        .call(
            d3.axisLeft(y)
                .tickSize(gApp.margin.left-svg.attr('width'))
            );
    },

    _showLegend: function(g) {
        var svg = d3.select('svg');
        var aW = svg.attr('width')/gApp.fieldVals.length;
        var series = g.selectAll('g')
            .data(gApp.fieldVals)
            .enter()
            .append('g')
            .attr("transform", function(d,i) {
                return "translate(" + ((i * aW)+10) + ',' + (+svg.attr('height') - 50) + ')';
            });

        series.append('rect')
            .attr('height', 20)
            .attr('width', 15)
            .attr("fill", (d, i) => z(i));

        var cp = series.append('clipPath')
            .attr('id', function(d) {
                return 'clipPath-'+d.data;
            });
        
        cp.append('rect')
            .attr('width', (aW - 5))
            .attr('height', 20);

        series.append('text')
            .attr('clip-path', function(d) { return 'url(#clipPath-'+d.data+')' ;})
            .attr('class', 'normalText')
            .attr('x', 20)
            .attr('y', 15)
            .text( d => d);
    },

    onSettingsUpdate: function() {
        console.log(gApp.getSetting('artefact'), gApp.getSetting('field'));
        gApp._getSnapShots();
    },

    _clearSVG: function(svg) {
        if (svg === undefined) { d3.selectAll('g').remove(); }
        else { svg.selectAll('g').remove(); }
    },

    _getSnapShots: function(){

        var me = this;
        //We want to set up the number of requests are the number of days in the sprint
        var promises = _.map(gApp.dates, function(daterange) {
            var deferred = Ext.create('Deft.Deferred');
            me._getSnapShotsInDateRange(daterange).then ({
                scope: me,
                success: function(snapshots) {
                    deferred.resolve({date: daterange, snapshots: snapshots});
                }
            });
            return deferred.getPromise();
        });

        Deft.Promise.all(promises).then( {
            scope: me,
            success: function(allsnapshots) {
               
                //Now run through all days looking for those changes
                var xz = [];
                var currentState = [];
                _.each(allsnapshots, function(snapshotData) {
                    var same = _.filter(snapshotData.snapshots, function(snapshot) {
                        return (_.findIndex(currentState, function(current) {
                            return current.get('ObjectID') === snapshot.get('ObjectID');
                        })>-1)?snapshot:undefined;
                    });
                    var added = _.filter(snapshotData.snapshots, function(snapshot) {
                        return (_.findIndex(currentState, function(current) {
                            return current.get('ObjectID') === snapshot.get('ObjectID');
                        })<0)?snapshot:undefined;
                    });
                    var removed = _.filter(currentState, function(current) {
                        return (_.findIndex(snapshotData.snapshots, function(snapshot) {
                            return current.get('ObjectID') === snapshot.get('ObjectID');
                        })<0)?current:undefined;
                    });
                    xz.push([same, added, removed]);
                    console.log([same, added, removed]);
                    currentState = Ext.clone(snapshotData.snapshots);

                });
                if (xz.length) {
                    gApp.xz = xz;
                    gApp.chart = gApp._drawStuff(xz);
                    gApp.chart.update();
                }
            }
        });
    }, 

    _getSnapShotsInDateRange: function(interval) {
        var deferred = new Deft.Deferred();
    
        var find = {
            "Iteration" : { "$in" : [this.down('#iterationCombo').getRecord().get('ObjectID')] },
            "__At" : interval.end,
            "_TypeHierarchy":{"$in":[gApp.artefactType]}
        };

        var fields = ["_TypeHierarchy","ObjectID","FormattedID","_ValidFrom","PlanEstimate", 'ScheduleState',"Name"];
        var hydrate = [ 'ScheduleState' /**, "_TypeHierarchy"**/];

        var config = {
            find : find,
            fetch : fields,
            hydrate : hydrate,
            autoLoad : true,
            limit: Infinity,
            compress: true,
            removeUnauthorizedSnapshots: true,
            listeners: {
                load: function(store, data, success) {
                    if (success) {
                        deferred.resolve(data);
                    }
                    else {
                        deferred.reject('Could not load snapshots');
                    }
                }
            }
        };
        Ext.create( 'Rally.data.lookback.SnapshotStore', config );
        return deferred.getPromise();
    },

    _drawStuff: function(yz) {
        var n = gApp.fieldVals.length;

        svg = d3.select('svg');
        gApp._clearSVG(svg);
        svg.attr('width', gApp.el.getWidth() - 50);
        svg.attr('height', gApp.el.getHeight() - (gApp.down('#headerBox').getHeight() + 50));  //Leave a bit at the top for combo box
        // n = 5,
        // m = 58
        //  xz = _.pluck(gApp.dates, function(date) { return new Date(date.start);});
        xz = _.pluck(gApp.dates, 'start');
        // xz = d3.range(m);
        y01z = d3.stack()
            .keys(d3.range(n))
            .value( (d,key) => {
                if (true === gApp.getSetting('usePlanEstimate')) {
                    var total = 0;
                     _.forEach(d[key], function(item) {
                        total += item.get('PlanEstimate');
                    });
                    return total;
                } else {
                    return d[key].length;
                }
            })
            (yz) // stacked yz
            .map( function(data, i) {
                return data.map(
                        function([y0, y1]) { 
                            return [y0, y1, i]; 
                        });
                });

        yMax = d3.max(yz, (y) => {
            return d3.max(_.map(y, function(item) { 
                return item.length;
            }));
        });

        y1Max = d3.max(y01z, y => d3.max(y, (d) => { return d[1];}));

        x = d3.scaleBand()
            .domain(xz)
            .rangeRound([gApp.margin.left, svg.attr('width') - gApp.margin.right])
            .padding(0.08);
        
        y = d3.scaleLinear()
            .domain([0, y1Max])
            .range([svg.attr('height') - gApp.margin.bottom, gApp.margin.top]);

            // z = d3.scaleSequential(d3.interpolateCubehelixDefault)
        z = d3.scaleSequential(d3.interpolateCool)
           //.domain([-0.2 * n, 1.1 * n]);
           .domain([0, n]);

        var g = svg.selectAll("g")
              .data(y01z)
              .enter().append("g")
                .attr("fill", (d, i) => z(i));
                
        gApp.tooltip = svg.append('g');
             
        const rect = g.selectAll("rect")
              .data(d => d)
              .join("rect")
                .attr("x", function(d, i) { 
                    return x(gApp.dates[i].start);
                })
                .attr("y", svg.attr('height') - gApp.margin.bottom)
                .attr("width", x.bandwidth())
                .attr("height", 0)
                .on('mouseover', function(d, i, arr) {
                    gApp._mouseOver(d, i, arr);
                })                
                .on('mouseout', function(d, i, arr) {
                    gApp._mouseOut(d, i, arr);
                });
        
        svg.append("g")
        .call(gApp._setXAxis);
    
        svg.append("g")
        .call(gApp._setYAxis);
    
        svg.append('g')
            .call(gApp._showLegend);
            
        svg.append('g')
            .append('text')
            .attr('x', svg.attr('width')- gApp.margin.left)
            .attr('y', gApp.margin.top - 5)
            .attr('class', 'normalText')
            .style('text-anchor', 'end')
            .text( gApp.artefactType+": "+gApp.fieldName+(gApp.getSetting('usePlanEstimate')?' (Points)':' (Count)'));
 
        function transitionGrouped() {
            y.domain([0, yMax]);          
            gApp.yAxis.call(gApp._setYAxis);
            rect.transition()
                    .duration(500)
                    .delay((d, i) => i * 20)
                    .attr("x", function (d, i) { 
                        return  x(gApp.dates[i].start) + ((x.bandwidth() / n) * d[2]); 
                    })
                    .attr("width", x.bandwidth() / n)
                .transition()
                    .attr("y", d => y(d[1] - d[0]))
                    .attr("height", d => y(0) - y(d[1] - d[0]));
        }
          
        function transitionStacked() {
            y.domain([0, y1Max]);
            gApp.yAxis.call(gApp._setYAxis);
            rect.transition()
                .duration(500)
                .delay((d, i) => i * 20)
                .attr("y", d => y(d[1]))
                .attr("height", d => y(d[0]) - y(d[1]))
                .transition()
                .attr("x", function(d, i) { 
                    return x(gApp.dates[i].start);
                })
                .attr("width", x.bandwidth());
            }
          
        function update() {
            var layout = gApp.down('#stackGroupButton');
            if (layout.getText() === "Group") { //If button is saying Group, we must display in the other format
                transitionStacked();
            }
            else {
                transitionGrouped();
            }
        }
          
        return Object.assign(svg.node(), {update});
    },

    _mouseOver: function(d,i) {
        var artefacts = _.map(gApp.xz[i][d[2]],
                function(snapshot) {
                    return snapshot.get('FormattedID');
                }
        );
        gApp.tooltip.attr( 'transform',
            `translate(${d3.event.layerX},${d3.event.layerY})`
        );
        gApp.callout(gApp.tooltip, artefacts.join('\n'));
    },
    
    _mouseOut: function() {
        gApp.callout( gApp.tooltip, null);
    },
    
    callout: function(g, value) {
        if (!value) { return g.style("display", "none");}
      
        g.style("display", null)
            .style("pointer-events", "none")
            .style("font", "10px sans-serif");
      
        const path = g.selectAll("path")
          .data([null])
          .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");
      
        const text = g.selectAll("text")
          .data([null])
          .join("text")
          .call(text => text
            .selectAll("tspan")
            .data((value + "").split(/\n/))
            .join("tspan")
              .attr("x", 0)
              .attr("y", (d, i) => `${i * 1.1}em`)
              .text(d => d));
      
        const {x, y, width: w, height: h} = text.node().getBBox();
      
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
    },

    possibleTypes: [
        { name: 'Stories',      value: 'HierarchicalRequirement'},
        { name: 'Defects',      value: 'Defect',                },
        { name: 'Tasks',        value: 'Task',                  },
        { name: 'Defect Suite', value: 'DefectSuite',           },
        { name: 'Test Sets',    value: 'TestSet',               }
    ],

    _createFieldValueCombo: function() {

        var theCombo = null;
        return theCombo;
    },

    artefactType: null,

    launch: function() {
        //What type(s) are we going to do this for
        this.artefactType = this.getSetting('artefact');    //Defaults to HierarchicalRequirement
        this.fieldName = 'Scope Changes';          //Defaults to ScheduleState

        this.down('#headerBox').insert(0,
            [
                {
                    xtype: 'rallyiterationcombobox',
                    itemId: 'iterationCombo',
                    stateful: true,
                    stateId: gApp.getContext().getScopedStateId('ricbox'),
                    storeConfig: {
                        listeners: {
                            load: function() {
                                var iteration = this.requester.getRecord();
                                gApp.dates = gApp._getDateArray(iteration);
                                gApp._getSnapShots();
                            }
                        }
                    },
                    listeners: {
                        select: function() {
                            var iteration = this.getRecord();
                            gApp.dates = gApp._getDateArray(iteration);
                            gApp._clearSVG();
                            gApp._getSnapShots();
                        }
                    }
                },
                {
                    xtype: 'rallybutton',
                    text: 'Group',
                    itemId: 'stackGroupButton',
                    handler: function() {
                        if (this.text === 'Group') {
                            this.setText('Stack');
                        }
                        else {
                            this.setText('Group');
                        }
                        gApp.chart.update();
                    }
                }
            ]
        );

        //Create a store to house our records
        this.store = Ext.create('Ext.data.Store',{
            model: 'typesToChoose',
            data:   this.possibleTypes,
            proxy: 'memory',
            autoLoad: false

        });

        //this._getSnapShots();

    },

 
});
}());