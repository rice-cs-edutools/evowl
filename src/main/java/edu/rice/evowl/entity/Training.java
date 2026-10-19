package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * Training Info
 */
@Data
@ApiModel("Training Info")
public class Training {

  @ApiModelProperty("primary key")
  private Integer assignment_id;

  @ApiModelProperty("first submission paths")
  private String submission1_paths;

  @ApiModelProperty("second submission paths")
  private String submission2_paths;

  @ApiModelProperty("answers")
  private String answers;

  @ApiModelProperty("feedback")
  private String feedback;
}
