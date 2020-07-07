# Sprint Change Chart
![alt text](https://github.com/nikantonelli/SprintChangeChart/blob/master/Images/Image.png)

This app looks into the LBAPI to pull changes to a field (of your selection) on a artefact type (of your selection) that could be involved with a particular iteration. The field type must have definite values (e.g. ScheduleState)

This could be useful if you want to see what changes were made, rather than the cumulative flow diagram that shows you the 'current state'

For each day in the selected sprint, the daily changes are shown as either a stacked bar or as a group of individual bars to represent the (finite) values of the field.

Please note that this app takes data direct from the LBAPI database and does not correct for any anomalies, e.g. people moving stories back and forth between states within the same day. Do not use the numbers as the gospel truth without cross referencing.
