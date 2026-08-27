# Capability Generation Workspace

This application exposes Feature 017's sole generation path: a registered capability produces a
frozen specification and graph, then a separately authorized batch is processed by the unique
worker. Planning and review make zero external calls. The worker remains stopped until an exact,
fresh action-time authorization has been recorded.
