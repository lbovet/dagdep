# dagdep
Extracts module dependencies to feed a graph database model

# Usage

```
dagdep - Extracts module dependencies to feed a graph database model

Synopsis

$ dagdep <options>                                        

The options can be specified in any form specified in rc.
See https://www.npmjs.com/package/rc.                     

Options

--repository.type [artifactory|stdin]     Repository type. Defaults to stdin if no URL is given. artifactory,           
                                          otherwise.                                                                    
--repository.url url                      Repository base URL                                                           
--repository.username username            Repository credentials                                                        
--repository.password password                                                                                          
--resolver.type [maven|nuget|npm|chain]   Repository for artifact resolution. Defaults to chain if no context is given.
                                          maven, otherwise.                                                             
--resolver.context resolution-context     Repository context for artifact resolution                                    
--resolver.visit visit-context, ...       Repository contexts to visit, defaults to resolution-context                  
--database.type [neo4j|filesystem]        Database type. Defaults to filesystem if no context is given. neo4j,          
                                          otherwise                                                                     
--database.url url                        Database URL                                                                  
--database.username username              Databse credentials                                                           
--database.password password                                                                                            
--help                                    Print this usage guide.          
```
